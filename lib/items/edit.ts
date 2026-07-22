import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { normalizeUuid } from "@/lib/projects";
import {
  InvalidItemError,
  InvalidItemStateError,
  requireItemId,
} from "@/lib/review-or-deletion/contracts";

export const editItemDeps = {
  db,
  sendItemCaptured: async (itemId: string) => {
    await inngest.send({ name: "item/captured", data: { itemId } });
  },
};

type OwnedRow = {
  id: string;
  userId: string;
  projectId: string;
  status: string;
};

// Metadata edits are refused on items on their way out; those live in the trash
// view, not the library, so renaming or retagging them makes no sense.
const EDIT_BLOCKED_STATUSES = new Set(["trashed", "deleting"]);
// Reprocess replays extract → chunk → embed → enrich. Only a settled item is
// eligible: an in-flight one is already running, and held/trashed ones are not
// in the library. A failed item is the prime candidate for a retry.
const REPROCESS_STATUSES = new Set(["ready", "failed"]);

async function loadOwned(
  userId: string,
  projectId: string,
  itemId: unknown
): Promise<OwnedRow> {
  const rows = await editItemDeps.db
    .select({
      id: schema.item.id,
      userId: schema.item.userId,
      projectId: schema.item.projectId,
      status: schema.item.status,
    })
    .from(schema.item)
    .where(eq(schema.item.id, requireItemId(itemId)))
    .limit(1);

  const row = rows[0];
  // Ownership and project are checked together: a foreign item, or one in
  // another project, is indistinguishable from a missing one on purpose.
  if (
    !row ||
    row.userId !== userId ||
    normalizeUuid(row.projectId) !== normalizeUuid(projectId)
  ) {
    throw new InvalidItemError();
  }
  return row;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new InvalidItemStateError("tags must be an array of strings");
  }
  const tags: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      throw new InvalidItemStateError("tags must be an array of strings");
    }
    const trimmed = entry.trim();
    if (trimmed && !tags.includes(trimmed)) tags.push(trimmed);
  }
  return tags;
}

export type EditItemInput = { title?: unknown; tags?: unknown };
export type EditedItem = {
  id: string;
  title: string | null;
  tags: string[];
  status: string;
};

// Rename (title) and/or retag (tags) an owned item. At least one field must be
// present. Title, when given, must be a non-empty string; tags, when given, may
// be an empty array to clear them.
export async function editItem(
  userId: string,
  projectId: string,
  itemId: unknown,
  input: EditItemInput
): Promise<EditedItem> {
  const item = await loadOwned(userId, projectId, itemId);
  if (EDIT_BLOCKED_STATUSES.has(item.status)) {
    throw new InvalidItemStateError("item is in the trash");
  }

  const update: { title?: string; tags?: string[] } = {};

  if (input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.trim().length === 0) {
      throw new InvalidItemStateError("title must be a non-empty string");
    }
    update.title = input.title.trim();
  }

  if (input.tags !== undefined) {
    update.tags = normalizeTags(input.tags);
  }

  if (update.title === undefined && update.tags === undefined) {
    throw new InvalidItemStateError("nothing to update");
  }

  const [updated] = await editItemDeps.db
    .update(schema.item)
    .set(update)
    .where(
      and(
        eq(schema.item.id, item.id),
        eq(schema.item.userId, userId),
        eq(schema.item.projectId, projectId)
      )
    )
    .returning({
      id: schema.item.id,
      title: schema.item.title,
      tags: schema.item.tags,
      status: schema.item.status,
    });

  return {
    id: updated.id,
    title: updated.title,
    tags: updated.tags ?? [],
    status: updated.status,
  };
}

export type ReprocessedItem = { id: string; status: string };

// Reprocess an owned item: drop its chunks, reset it to pending, and re-emit
// item/captured so the worker replays the pipeline. Chunks are deleted first
// because the worker inserts without clearing, so a replay would otherwise
// duplicate them. The status reset matters too: the worker skips ready items.
export async function reprocessItem(
  userId: string,
  projectId: string,
  itemId: unknown
): Promise<ReprocessedItem> {
  const item = await loadOwned(userId, projectId, itemId);
  if (!REPROCESS_STATUSES.has(item.status)) {
    throw new InvalidItemStateError("item is not ready to reprocess");
  }

  await editItemDeps.db
    .delete(schema.chunk)
    .where(
      and(eq(schema.chunk.itemId, item.id), eq(schema.chunk.userId, userId))
    );

  await editItemDeps.db
    .update(schema.item)
    .set({ status: "pending" })
    .where(
      and(
        eq(schema.item.id, item.id),
        eq(schema.item.userId, userId),
        eq(schema.item.projectId, projectId)
      )
    );

  await editItemDeps.sendItemCaptured(item.id);

  return { id: item.id, status: "pending" };
}

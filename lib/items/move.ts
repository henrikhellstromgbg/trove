import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { isUuid, normalizeUuid } from "@/lib/projects";
import {
  InvalidItemError,
  InvalidItemStateError,
} from "@/lib/review-or-deletion/contracts";

// Destination equals the item's current project. Distinct from an ownership or
// state error, so the route can answer 400 rather than 404/409.
export class SameProjectMoveError extends Error {
  constructor() {
    super("Item is already in that project");
    this.name = "SameProjectMoveError";
  }
}

export type MoveItemResult =
  | { action: "moved"; itemId: string }
  | { action: "copied"; itemId: string; newItemId: string };

export const moveItemDeps = {
  db,
  sendItemCaptured: async (itemId: string) => {
    await inngest.send({ name: "item/captured", data: { itemId } });
  },
};

// Move (manual) or copy (source-attributed) an item into another project the
// same user owns. `toProjectId` must already be validated as owned by `userId`
// (the route does this); the user never changes, so this never crosses the
// user boundary — only the project one, deliberately.
export async function moveItemToProject(
  userId: string,
  itemId: string,
  toProjectId: string
): Promise<MoveItemResult> {
  if (!isUuid(itemId)) throw new InvalidItemError();

  const rows = await moveItemDeps.db
    .select({
      id: schema.item.id,
      userId: schema.item.userId,
      projectId: schema.item.projectId,
      sourceId: schema.item.sourceId,
      status: schema.item.status,
      type: schema.item.type,
      source: schema.item.source,
      rawText: schema.item.rawText,
    })
    .from(schema.item)
    .where(eq(schema.item.id, normalizeUuid(itemId)))
    .limit(1);

  const item = rows[0];
  if (!item || item.userId !== userId) throw new InvalidItemError();
  // Only a ready item can move: a move re-scopes its chunks, a copy reuses its
  // extracted text, and both rely on the item being fully processed.
  if (item.status !== "ready") {
    throw new InvalidItemStateError("Only a ready item can be moved or copied");
  }
  if (normalizeUuid(item.projectId) === normalizeUuid(toProjectId)) {
    throw new SameProjectMoveError();
  }

  // A source belongs to exactly one project, so a source-attributed item is
  // copied, never moved, to avoid a cross-project source_id. The copy carries
  // the item's type/source and extracted text, detached from the source, and is
  // reprocessed in the destination. It deliberately does NOT share the blob, so
  // deleting the original's file can never break the copy (url items refetch
  // from `source`, others chunk the carried rawText).
  if (item.sourceId) {
    const newItemId = await moveItemDeps.db.transaction(async (tx) => {
      const [copy] = await tx
        .insert(schema.item)
        .values({
          userId,
          projectId: toProjectId,
          sourceId: null,
          externalId: null,
          type: item.type,
          source: item.source,
          ...(item.rawText != null ? { rawText: item.rawText } : {}),
          status: "pending",
        })
        .returning({ id: schema.item.id });
      return copy.id;
    });

    // Emitted after commit so a failed enqueue can't roll back the copy.
    await moveItemDeps.sendItemCaptured(newItemId);
    return { action: "copied", itemId: item.id, newItemId };
  }

  // Manual item: move it and its chunks, and drop it from any topic cluster in
  // the origin project so no topic references an item now behind another wall.
  await moveItemDeps.db.transaction(async (tx) => {
    await tx
      .update(schema.item)
      .set({ projectId: toProjectId })
      .where(eq(schema.item.id, item.id));

    await tx
      .update(schema.chunk)
      .set({ projectId: toProjectId })
      .where(eq(schema.chunk.itemId, item.id));

    await tx
      .update(schema.topic)
      .set({
        itemIds: sql`array_remove(${schema.topic.itemIds}, ${item.id}::uuid)`,
      })
      .where(
        and(
          eq(schema.topic.userId, userId),
          eq(schema.topic.projectId, item.projectId)
        )
      );
  });

  return { action: "moved", itemId: item.id };
}

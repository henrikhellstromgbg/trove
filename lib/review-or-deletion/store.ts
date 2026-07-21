import { del } from "@vercel/blob";
import { and, desc, eq, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import type {
  DeletionMarker,
  Item,
  ReviewDecision,
} from "@/lib/db/schema";
import {
  assertReviewDecision,
  buildRestoreUpdate,
  buildReviewDecisionUpdate,
  buildTrashUpdate,
  InvalidItemStateError,
  requireItemId,
  trashDeleteAt,
  verifyItemOwnership,
  type OwnedItemRow,
  type ReviewDecisionValue,
} from "./contracts";

const PRIVATE_HOST_MARKER = ".private.blob.vercel-storage.com";

type MutableItemFields = Pick<
  Item,
  | "id"
  | "userId"
  | "projectId"
  | "status"
  | "trashedAt"
  | "restoreStatus"
  | "sourceId"
  | "externalId"
  | "blobUrl"
>;

export type ReviewQueueItem = Pick<
  Item,
  "id" | "type" | "source" | "title" | "summary" | "capturedAt" | "status"
>;

export type TrashQueueItem = Pick<
  Item,
  "id" | "type" | "source" | "title" | "summary" | "status" | "trashedAt" | "restoreStatus"
> & {
  deleteAfterAt: Date;
};

export type ItemMutationResult = {
  item: Pick<Item, "id" | "status" | "trashedAt" | "restoreStatus">;
};

export type PermanentDeleteResult = {
  itemId: string;
  markerWritten: boolean;
  blobDeleted: boolean;
};

export const reviewOrDeletionDeps = {
  db,
  now: () => new Date(),
  sendItemCaptured: async (itemId: string) => {
    await inngest.send({ name: "item/captured", data: { itemId } });
  },
  deleteBlobIfPresent: async (blobUrl: string | null) => {
    if (!blobUrl || !blobUrl.includes(PRIVATE_HOST_MARKER)) return false;
    await del(blobUrl, {
      token: process.env.PRIVATE_BLOB_READ_WRITE_TOKEN,
    });
    return true;
  },
};

function toOwnedItemRow(item: MutableItemFields): OwnedItemRow {
  return item;
}

async function loadOwnedItem(
  userId: string,
  projectId: string,
  itemId: unknown
): Promise<OwnedItemRow> {
  const normalizedItemId = requireItemId(itemId);
  const rows = await reviewOrDeletionDeps.db
    .select({
      id: schema.item.id,
      userId: schema.item.userId,
      projectId: schema.item.projectId,
      status: schema.item.status,
      trashedAt: schema.item.trashedAt,
      restoreStatus: schema.item.restoreStatus,
      sourceId: schema.item.sourceId,
      externalId: schema.item.externalId,
      blobUrl: schema.item.blobUrl,
    })
    .from(schema.item)
    .where(eq(schema.item.id, normalizedItemId))
    .limit(1);

  return verifyItemOwnership(userId, projectId, rows[0] ? toOwnedItemRow(rows[0]) : undefined);
}

export async function listReviewItems(
  userId: string,
  projectId: string
): Promise<ReviewQueueItem[]> {
  return reviewOrDeletionDeps.db
    .select({
      id: schema.item.id,
      type: schema.item.type,
      source: schema.item.source,
      title: schema.item.title,
      summary: schema.item.summary,
      capturedAt: schema.item.capturedAt,
      status: schema.item.status,
    })
    .from(schema.item)
    .where(
      and(
        eq(schema.item.userId, userId),
        eq(schema.item.projectId, projectId),
        eq(schema.item.status, "review")
      )
    )
    .orderBy(desc(schema.item.capturedAt));
}

export async function listTrashItems(
  userId: string,
  projectId: string
): Promise<TrashQueueItem[]> {
  const rows = await reviewOrDeletionDeps.db
    .select({
      id: schema.item.id,
      type: schema.item.type,
      source: schema.item.source,
      title: schema.item.title,
      summary: schema.item.summary,
      status: schema.item.status,
      trashedAt: schema.item.trashedAt,
      restoreStatus: schema.item.restoreStatus,
    })
    .from(schema.item)
    .where(
      and(
        eq(schema.item.userId, userId),
        eq(schema.item.projectId, projectId),
        or(eq(schema.item.status, "trashed"), eq(schema.item.status, "deleting"))
      )
    )
    .orderBy(desc(schema.item.trashedAt));

  return rows
    .filter((row): row is typeof row & { trashedAt: Date } => row.trashedAt instanceof Date)
    .map((row) => ({
      ...row,
      deleteAfterAt: trashDeleteAt(row.trashedAt),
    }));
}

export async function moveItemToTrash(
  userId: string,
  projectId: string,
  itemId: unknown
): Promise<ItemMutationResult> {
  const item = await loadOwnedItem(userId, projectId, itemId);
  const update = buildTrashUpdate(item, reviewOrDeletionDeps.now());

  const [updated] = await reviewOrDeletionDeps.db
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
      status: schema.item.status,
      trashedAt: schema.item.trashedAt,
      restoreStatus: schema.item.restoreStatus,
    });

  return { item: updated };
}

export async function restoreItem(
  userId: string,
  projectId: string,
  itemId: unknown
): Promise<ItemMutationResult> {
  const item = await loadOwnedItem(userId, projectId, itemId);
  const update = buildRestoreUpdate(item);

  const [updated] = await reviewOrDeletionDeps.db
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
      status: schema.item.status,
      trashedAt: schema.item.trashedAt,
      restoreStatus: schema.item.restoreStatus,
    });

  return { item: updated };
}

export async function applyReviewDecision(
  userId: string,
  projectId: string,
  itemId: unknown,
  decisionInput: unknown,
  note?: string | null
): Promise<ItemMutationResult & { decision: ReviewDecision }> {
  const item = await loadOwnedItem(userId, projectId, itemId);
  const decision = assertReviewDecision(decisionInput);
  const { itemUpdate, decisionRow } = buildReviewDecisionUpdate(
    item,
    decision,
    reviewOrDeletionDeps.now()
  );

  const result = await reviewOrDeletionDeps.db.transaction(async (tx) => {
    const [decisionRecord] = await tx
      .insert(schema.reviewDecision)
      .values({
        userId,
        projectId,
        itemId: item.id,
        decision: decisionRow.decision,
        decidedAt: decisionRow.decidedAt,
        note: note ?? null,
      })
      .returning();

    const [updated] = await tx
      .update(schema.item)
      .set(itemUpdate)
      .where(
        and(
          eq(schema.item.id, item.id),
          eq(schema.item.userId, userId),
          eq(schema.item.projectId, projectId)
        )
      )
      .returning({
        id: schema.item.id,
        status: schema.item.status,
        trashedAt: schema.item.trashedAt,
        restoreStatus: schema.item.restoreStatus,
      });

    return { item: updated, decision: decisionRecord };
  });

  // Approval re-enters the ingest pipeline. Emitted only after the decision and
  // status change commit, so a rolled-back approval never triggers processing.
  // Best-effort like the ingest route: the approve has already committed, so a
  // transient emit failure is logged rather than surfaced as a 500.
  if (decision === "approve" && result.item.status === "pending") {
    try {
      await reviewOrDeletionDeps.sendItemCaptured(result.item.id);
    } catch (e) {
      console.warn(
        "[review] approve emit failed; item stays pending until re-triggered:",
        e instanceof Error ? e.message : e
      );
    }
  }

  return result;
}

export async function permanentlyDeleteItem(
  userId: string,
  projectId: string,
  itemId: unknown
): Promise<PermanentDeleteResult> {
  const item = await loadOwnedItem(userId, projectId, itemId);
  if ((item.status !== "trashed" && item.status !== "deleting") || !item.trashedAt) {
    throw new InvalidItemStateError("item is not in trash");
  }

  const markerWritten = item.sourceId != null && item.externalId != null;

  if (item.status === "trashed") {
    await reviewOrDeletionDeps.db.transaction(async (tx) => {
      if (markerWritten) {
        await tx
          .insert(schema.deletionMarker)
          .values({
            userId,
            projectId,
            sourceId: item.sourceId!,
            externalId: item.externalId!,
          })
          .onConflictDoNothing();
      }

      if (markerWritten) {
        await tx
          .delete(schema.originalRecord)
          .where(
            and(
              eq(schema.originalRecord.userId, userId),
              eq(schema.originalRecord.projectId, projectId),
              eq(schema.originalRecord.sourceId, item.sourceId!),
              eq(schema.originalRecord.externalId, item.externalId!)
            )
          );
      } else {
        await tx
          .delete(schema.originalRecord)
          .where(
            and(
              eq(schema.originalRecord.userId, userId),
              eq(schema.originalRecord.projectId, projectId),
              eq(schema.originalRecord.itemId, item.id)
            )
          );
      }

      await tx
        .update(schema.item)
        .set({ status: "deleting" })
        .where(
          and(
            eq(schema.item.id, item.id),
            eq(schema.item.userId, userId),
            eq(schema.item.projectId, projectId)
          )
        )
        .returning({ id: schema.item.id });
    });
  }

  const blobDeleted = await reviewOrDeletionDeps.deleteBlobIfPresent(item.blobUrl);

  await reviewOrDeletionDeps.db
    .delete(schema.item)
    .where(
      and(
        eq(schema.item.id, item.id),
        eq(schema.item.userId, userId),
        eq(schema.item.projectId, projectId)
      )
    );

  return {
    itemId: item.id,
    markerWritten,
    blobDeleted,
  };
}

export type ReviewOrDeletionDecision = ReviewDecisionValue;
export type ReviewOrDeletionMarker = DeletionMarker;

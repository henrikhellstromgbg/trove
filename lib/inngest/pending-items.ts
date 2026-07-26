import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const PENDING_RECOVERY_BATCH_SIZE = 100;

type CapturedEvent = {
  name: "item/captured";
  data: { itemId: string };
};

type SendCapturedEvent = (event: CapturedEvent) => Promise<unknown>;

// Claiming is an atomic pending -> processing transition. Separate deliveries
// of the same event can race, but only one of them is allowed to continue into
// extraction and chunk creation.
export async function claimPendingItem(
  itemId: string,
  database: typeof db = db
): Promise<boolean> {
  const claimed = await database
    .update(schema.item)
    .set({ status: "processing" })
    .where(and(eq(schema.item.id, itemId), eq(schema.item.status, "pending")))
    .returning({ id: schema.item.id });

  return claimed.length === 1;
}

export async function markProcessingItemFailed(
  itemId: string,
  database: typeof db = db
): Promise<boolean> {
  const failed = await database
    .update(schema.item)
    .set({ status: "failed" })
    .where(and(eq(schema.item.id, itemId), eq(schema.item.status, "processing")))
    .returning({ id: schema.item.id });

  return failed.length === 1;
}

// Re-emit persisted pending work after the job runner comes back. The database
// is the durable queue boundary; claimPendingItem makes repeated recovery runs
// and duplicate event delivery safe.
export async function reemitPendingItems(
  send: SendCapturedEvent,
  database: typeof db = db,
  limit = PENDING_RECOVERY_BATCH_SIZE
): Promise<string[]> {
  const pending = await database
    .select({ id: schema.item.id })
    .from(schema.item)
    .where(eq(schema.item.status, "pending"))
    .orderBy(asc(schema.item.capturedAt))
    .limit(limit);

  await Promise.all(
    pending.map(({ id }) => send({ name: "item/captured", data: { itemId: id } }))
  );

  return pending.map(({ id }) => id);
}

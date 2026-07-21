import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type DeletionMarkerReader = Pick<typeof db, "select">;

export class DeletedExternalItemError extends Error {
  constructor(message = "item was permanently deleted and cannot be re-imported") {
    super(message);
    this.name = "DeletedExternalItemError";
  }
}

export async function loadDeletedExternalIds(
  reader: DeletionMarkerReader,
  projectId: string,
  sourceId: string,
  externalIds: string[]
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();

  const rows = await reader
    .select({ externalId: schema.deletionMarker.externalId })
    .from(schema.deletionMarker)
    .where(
      and(
        eq(schema.deletionMarker.projectId, projectId),
        eq(schema.deletionMarker.sourceId, sourceId),
        inArray(schema.deletionMarker.externalId, externalIds)
      )
    );

  return new Set(rows.map((row) => row.externalId));
}

export async function assertExternalItemNotDeleted(
  reader: DeletionMarkerReader,
  projectId: string,
  sourceId: string | null,
  externalId: string | null
): Promise<void> {
  if (!sourceId || !externalId) return;

  const deletedExternalIds = await loadDeletedExternalIds(
    reader,
    projectId,
    sourceId,
    [externalId]
  );
  if (deletedExternalIds.has(externalId)) {
    throw new DeletedExternalItemError();
  }
}

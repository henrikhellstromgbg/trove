import { InvalidProjectError, isUuid, normalizeUuid } from "@/lib/projects";

// Pure validation for /api/ingest, kept out of the route file so the
// isolation tests can exercise the real comparisons with real rows.

export class LockedProjectError extends Error {
  constructor() {
    super("Ingest token is locked to another project");
    this.name = "LockedProjectError";
  }
}

export class InvalidSourceError extends Error {
  constructor() {
    super("Invalid sourceId");
    this.name = "InvalidSourceError";
  }
}

// A project-bound token is a hard lock. Omitting projectId selects the lock;
// naming any other project is forbidden. UUID text is case-insensitive, so
// both sides are normalized before comparison.
export function enforceTokenLock(
  lockedProjectId: string | null,
  providedProjectId: unknown
): void {
  if (providedProjectId != null && !isUuid(providedProjectId)) {
    throw new InvalidProjectError();
  }
  if (
    lockedProjectId &&
    providedProjectId != null &&
    normalizeUuid(providedProjectId as string) !== normalizeUuid(lockedProjectId)
  ) {
    throw new LockedProjectError();
  }
}

export type SourceOwnershipRow = {
  id: string;
  userId: string;
  projectId: string;
};

// The single source-ownership decision point, pure so tests can feed it real
// rows. The source must exist, belong to the same user AND to the resolved
// project. Removing any comparison must fail the isolation tests.
export function verifySourceOwnership(
  userId: string,
  projectId: string,
  row: SourceOwnershipRow | undefined
): string {
  if (!row) throw new InvalidSourceError();
  if (row.userId !== userId) throw new InvalidSourceError();
  if (normalizeUuid(row.projectId) !== normalizeUuid(projectId)) {
    throw new InvalidSourceError();
  }
  return row.id;
}

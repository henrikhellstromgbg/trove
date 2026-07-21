import { InvalidProjectError, isUuid, normalizeUuid } from "@/lib/projects";
import {
  InvalidSourceError,
  type SourceOwnershipRow,
  verifySourceOwnership,
} from "@/lib/sources/contracts";

// Pure validation for /api/ingest, kept out of the route file so the
// isolation tests can exercise the real comparisons with real rows.

export { InvalidSourceError, verifySourceOwnership };
export type { SourceOwnershipRow };

export class LockedProjectError extends Error {
  constructor() {
    super("Ingest token is locked to another project");
    this.name = "LockedProjectError";
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

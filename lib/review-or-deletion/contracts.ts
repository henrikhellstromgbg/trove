import { InvalidProjectError, isUuid, normalizeUuid, requireProjectId } from "@/lib/projects";

export const REVIEW_DECISIONS = ["approve", "reject"] as const;
export const TRASH_RETENTION_DAYS = 30;

const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type ReviewDecisionValue = (typeof REVIEW_DECISIONS)[number];

export type OwnedItemRow = {
  id: string;
  userId: string;
  projectId: string;
  status: string;
  trashedAt: Date | null;
  restoreStatus: string | null;
  sourceId: string | null;
  externalId: string | null;
  blobUrl: string | null;
};

export class InvalidItemError extends Error {
  constructor(message = "Invalid itemId") {
    super(message);
    this.name = "InvalidItemError";
  }
}

export class InvalidItemStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidItemStateError";
  }
}

export class InvalidReviewDecisionError extends Error {
  constructor(message = "Invalid review decision") {
    super(message);
    this.name = "InvalidReviewDecisionError";
  }
}

export function isReviewDecisionValue(value: unknown): value is ReviewDecisionValue {
  return typeof value === "string" && REVIEW_DECISIONS.includes(value as ReviewDecisionValue);
}

export function requireItemId(itemId: unknown): string {
  if (!isUuid(itemId)) throw new InvalidItemError();
  return normalizeUuid(itemId);
}

export async function requireExplicitProjectId(
  userId: string,
  provided: unknown,
  requireProjectIdFn: typeof requireProjectId
): Promise<string> {
  if (provided == null || provided === "") {
    throw new InvalidProjectError("projectId is required");
  }
  return requireProjectIdFn(userId, provided);
}

export function verifyItemOwnership(
  userId: string,
  projectId: string,
  row: OwnedItemRow | undefined
): OwnedItemRow {
  if (!row) throw new InvalidItemError();
  if (row.userId !== userId) throw new InvalidItemError();
  if (normalizeUuid(row.projectId) !== normalizeUuid(projectId)) {
    throw new InvalidItemError();
  }
  return row;
}

export function trashDeleteAt(trashedAt: Date): Date {
  return new Date(trashedAt.getTime() + TRASH_RETENTION_MS);
}

export function buildTrashUpdate(item: OwnedItemRow, now: Date) {
  if (item.status === "deleting") {
    throw new InvalidItemStateError("item deletion is already in progress");
  }
  if (item.status === "trashed") {
    throw new InvalidItemStateError("item is already in trash");
  }

  return {
    status: "trashed",
    trashedAt: now,
    restoreStatus: item.status,
  } as const;
}

export function buildRestoreUpdate(item: OwnedItemRow) {
  if (item.status !== "trashed" || !item.trashedAt) {
    throw new InvalidItemStateError("item is not in trash");
  }

  return {
    status: item.restoreStatus ?? "ready",
    trashedAt: null,
    restoreStatus: null,
  } as const;
}

export function buildReviewDecisionUpdate(
  item: OwnedItemRow,
  decision: ReviewDecisionValue,
  now: Date
) {
  if (item.status !== "review") {
    throw new InvalidItemStateError("item is not in review");
  }

  if (decision === "approve") {
    // Held review items were never processed, so approval sends them back to
    // "pending" and re-emits item/captured; the normal extract/chunk/embed
    // pipeline then makes them "ready" and reachable by Ask.
    return {
      itemUpdate: {
        status: "pending",
        trashedAt: null,
        restoreStatus: null,
      } as const,
      decisionRow: {
        decision,
        decidedAt: now,
      } as const,
    };
  }

  return {
    itemUpdate: {
      status: "trashed",
      trashedAt: now,
      restoreStatus: "review",
    } as const,
    decisionRow: {
      decision,
      decidedAt: now,
    } as const,
  };
}

export function assertReviewDecision(value: unknown): ReviewDecisionValue {
  if (!isReviewDecisionValue(value)) {
    throw new InvalidReviewDecisionError();
  }
  return value;
}

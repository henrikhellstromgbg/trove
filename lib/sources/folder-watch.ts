import {
  DEFAULT_FOLDER_WATCH_GLOBS,
  type FolderWatchSourceConfig,
} from "./contracts";

export type FolderWatchCandidate = {
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: Date | string;
};

export type FolderWatchPendingIngest = {
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  externalId: string;
};

export type FolderWatchCheckpoint = {
  version: 1;
  files: Record<
    string,
    {
      modifiedAt: string;
      size: number;
      externalId: string;
    }
  >;
};

export function selectFolderWatchFiles(
  config: Pick<FolderWatchSourceConfig, "globs">,
  files: FolderWatchCandidate[],
  checkpoint?: FolderWatchCheckpoint | null
): FolderWatchPendingIngest[] {
  const normalizedCheckpoint = readFolderWatchCheckpoint(checkpoint);
  const globs =
    config.globs.length > 0 ? config.globs : [...DEFAULT_FOLDER_WATCH_GLOBS];

  return [...files]
    .map(normalizeFolderWatchCandidate)
    .filter((file) => matchesAnyGlob(file.relativePath, globs))
    .filter((file) => {
      const previous = normalizedCheckpoint.files[file.relativePath];
      return (
        !previous ||
        previous.modifiedAt !== file.modifiedAt ||
        previous.size !== file.size
      );
    })
    .sort((a, b) =>
      a.modifiedAt === b.modifiedAt
        ? a.relativePath.localeCompare(b.relativePath)
        : a.modifiedAt.localeCompare(b.modifiedAt)
    )
    .map((file) => ({
      ...file,
      externalId: createFolderWatchExternalId(file),
    }));
}

export function advanceFolderWatchCheckpoint(
  checkpoint: FolderWatchCheckpoint | null | undefined,
  files: FolderWatchPendingIngest[]
): FolderWatchCheckpoint {
  const next = readFolderWatchCheckpoint(checkpoint);
  for (const file of files) {
    next.files[file.relativePath] = {
      modifiedAt: file.modifiedAt,
      size: file.size,
      externalId: file.externalId,
    };
  }
  return next;
}

export function readFolderWatchCheckpoint(
  value: unknown
): FolderWatchCheckpoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { version: 1, files: {} };
  }

  const rawFiles = (value as { files?: unknown }).files;
  if (!rawFiles || typeof rawFiles !== "object" || Array.isArray(rawFiles)) {
    return { version: 1, files: {} };
  }

  const files: FolderWatchCheckpoint["files"] = {};
  for (const [relativePath, entry] of Object.entries(rawFiles)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const modifiedAt =
      typeof entry.modifiedAt === "string" ? entry.modifiedAt : null;
    const size = typeof entry.size === "number" ? entry.size : null;
    const externalId =
      typeof entry.externalId === "string" ? entry.externalId : null;
    if (!modifiedAt || size == null || !externalId) continue;
    files[normalizeRelativePath(relativePath)] = { modifiedAt, size, externalId };
  }

  return { version: 1, files };
}

export function createFolderWatchExternalId(
  file: Pick<FolderWatchPendingIngest, "relativePath" | "size" | "modifiedAt">
): string {
  return `${normalizeRelativePath(file.relativePath)}:${file.size}:${file.modifiedAt}`;
}

function normalizeFolderWatchCandidate(
  file: FolderWatchCandidate
): Omit<FolderWatchPendingIngest, "externalId"> {
  return {
    path: file.path,
    relativePath: normalizeRelativePath(file.relativePath),
    size: file.size,
    modifiedAt: normalizeModifiedAt(file.modifiedAt),
  };
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
}

function normalizeModifiedAt(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("modifiedAt must be a valid date");
  }
  return date.toISOString();
}

function matchesAnyGlob(path: string, globs: string[]): boolean {
  return globs.some((glob) => matchGlob(normalizeRelativePath(glob), path));
}

function matchGlob(glob: string, path: string): boolean {
  const globSegments = glob.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);
  return matchGlobSegments(globSegments, pathSegments);
}

function matchGlobSegments(globSegments: string[], pathSegments: string[]): boolean {
  if (globSegments.length === 0) return pathSegments.length === 0;

  const [segment, ...rest] = globSegments;
  if (segment === "**") {
    if (matchGlobSegments(rest, pathSegments)) return true;
    if (pathSegments.length === 0) return false;
    return matchGlobSegments(globSegments, pathSegments.slice(1));
  }

  if (pathSegments.length === 0) return false;
  if (!matchSegment(segment, pathSegments[0])) return false;
  return matchGlobSegments(rest, pathSegments.slice(1));
}

function matchSegment(glob: string, value: string): boolean {
  const pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${pattern}$`, "i").test(value);
}

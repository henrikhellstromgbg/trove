import { normalizeUuid } from "@/lib/projects";

export const SUPPORTED_SOURCE_KINDS = [
  "mail_folder",
  "folder_watch",
  "rss",
  "web_scrape",
  "slack_channel",
] as const;

export const SUPPORTED_CONNECTED_ACCOUNT_PROVIDERS = [
  "gmail",
  "slack",
  "local",
] as const;

export const SUPPORTED_SOURCE_RULE_TYPES = [
  "selection",
  "review",
] as const;

export type SupportedSourceKind = (typeof SUPPORTED_SOURCE_KINDS)[number];
export type SupportedConnectedAccountProvider =
  (typeof SUPPORTED_CONNECTED_ACCOUNT_PROVIDERS)[number];
export type SupportedSourceRuleType =
  (typeof SUPPORTED_SOURCE_RULE_TYPES)[number];

export type SourceRuleSnapshot = {
  id: string;
  version: number;
  ruleType: string;
  enabled: boolean;
};

export type SourceConfig =
  | MailFolderSourceConfig
  | FolderWatchSourceConfig
  | { feedUrl: string }
  | { url: string; selector?: string; followLinks: boolean }
  | { channelId: string; teamId?: string; mode: "poll" | "events" };

export type MailFolderSourceConfig = {
  mboxPath: string;
  senderAllow: string[];
  senderBlock: string[];
  promoBlocklist: string[];
};

export type FolderWatchSourceConfig = {
  folderPath: string;
  globs: string[];
};

export const DEFAULT_FOLDER_WATCH_GLOBS = [
  "**/*.pdf",
  "**/*.txt",
  "**/*.md",
  "**/*.docx",
  "**/*.xlsx",
  "**/*.csv",
] as const;

const SECRET_KEY_PATTERN =
  /(secret|token|refresh|access|clientsecret|idtoken|oauth|password)/i;

export class InvalidConnectedAccountError extends Error {
  constructor(message = "Invalid connectedAccountId") {
    super(message);
    this.name = "InvalidConnectedAccountError";
  }
}

export class InvalidSourceError extends Error {
  constructor(message = "Invalid sourceId") {
    super(message);
    this.name = "InvalidSourceError";
  }
}

export class SourceHasDeletionMarkersError extends Error {
  constructor() {
    super("Source has permanent deletion history and cannot be deleted");
    this.name = "SourceHasDeletionMarkersError";
  }
}

export class InvalidSourceRuleError extends Error {
  constructor(message = "Invalid source rule") {
    super(message);
    this.name = "InvalidSourceRuleError";
  }
}

export type ConnectedAccountOwnershipRow = {
  id: string;
  userId: string;
};

export type SourceOwnershipRow = {
  id: string;
  userId: string;
  projectId: string;
};

export function verifyConnectedAccountOwnership(
  userId: string,
  provided: string,
  row: ConnectedAccountOwnershipRow | undefined
): string {
  if (!row) throw new InvalidConnectedAccountError();
  if (row.userId !== userId) throw new InvalidConnectedAccountError();
  if (normalizeUuid(row.id) !== normalizeUuid(provided)) {
    throw new InvalidConnectedAccountError();
  }
  return row.id;
}

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

export function isSupportedSourceKind(
  value: unknown
): value is SupportedSourceKind {
  return (
    typeof value === "string" &&
    SUPPORTED_SOURCE_KINDS.includes(value as SupportedSourceKind)
  );
}

export function isSupportedConnectedAccountProvider(
  value: unknown
): value is SupportedConnectedAccountProvider {
  return (
    typeof value === "string" &&
    SUPPORTED_CONNECTED_ACCOUNT_PROVIDERS.includes(
      value as SupportedConnectedAccountProvider
    )
  );
}

export function isSupportedSourceRuleType(
  value: unknown
): value is SupportedSourceRuleType {
  return (
    typeof value === "string" &&
    SUPPORTED_SOURCE_RULE_TYPES.includes(value as SupportedSourceRuleType)
  );
}

export function runtimeForSourceKind(
  kind: SupportedSourceKind
): "cloud" | "local" {
  switch (kind) {
    case "mail_folder":
    case "folder_watch":
      return "local";
    case "rss":
    case "web_scrape":
    case "slack_channel":
      return "cloud";
  }
}

export function planNextSourceRule(
  existingRules: SourceRuleSnapshot[],
  nextRuleType: SupportedSourceRuleType,
  enabled: boolean
): { nextVersion: number; deactivateRuleIds: string[] } {
  return {
    nextVersion:
      existingRules.reduce((maxVersion, rule) => Math.max(maxVersion, rule.version), 0) + 1,
    deactivateRuleIds: enabled
      ? existingRules
          .filter((rule) => rule.enabled && rule.ruleType === nextRuleType)
          .map((rule) => rule.id)
      : [],
  };
}

export function summarizeActiveSourceRules<T extends SourceRuleSnapshot>(
  rules: T[]
): Partial<Record<SupportedSourceRuleType, T>> {
  const activeRules: Partial<Record<SupportedSourceRuleType, T>> = {};

  for (const rule of [...rules].sort((a, b) => b.version - a.version)) {
    if (!rule.enabled) continue;
    if (!isSupportedSourceRuleType(rule.ruleType)) continue;
    if (!activeRules[rule.ruleType]) {
      activeRules[rule.ruleType] = rule;
    }
  }

  return activeRules;
}

export function buildSourceConfig(
  kind: SupportedSourceKind,
  body: Record<string, unknown>
): { config: SourceConfig } | { error: string } {
  if (kind === "mail_folder") {
    const mboxPath = typeof body.mboxPath === "string" ? body.mboxPath.trim() : "";
    if (!mboxPath) return { error: "mboxPath is required" };
    return {
      config: {
        mboxPath,
        senderAllow: readStringList(body.senderAllow),
        senderBlock: readStringList(body.senderBlock),
        promoBlocklist: readStringList(body.promoBlocklist),
      },
    };
  }

  if (kind === "folder_watch") {
    const folderPath =
      typeof body.folderPath === "string" ? body.folderPath.trim() : "";
    if (!folderPath) return { error: "folderPath is required" };
    return {
      config: {
        folderPath,
        globs: readStringList(body.globs, {
          fallback: [...DEFAULT_FOLDER_WATCH_GLOBS],
        }),
      },
    };
  }

  if (kind === "rss") {
    const feedUrl = typeof body.feedUrl === "string" ? body.feedUrl.trim() : "";
    if (!feedUrl) return { error: "feedUrl is required" };
    return { config: { feedUrl } };
  }

  if (kind === "web_scrape") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return { error: "url is required" };
    const selector =
      typeof body.selector === "string" ? body.selector.trim() : "";
    const followLinks = body.followLinks === true;
    return {
      config: {
        url,
        followLinks,
        ...(selector ? { selector } : {}),
      },
    };
  }

  const channelId =
    typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!channelId) return { error: "channelId is required" };

  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  const mode = body.mode === "events" ? "events" : "poll";
  return {
    config: {
      channelId,
      mode,
      ...(teamId ? { teamId } : {}),
    },
  };
}

export function readJsonObject(
  value: unknown,
  errorMessage: string
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidSourceRuleError(errorMessage);
  }
  return value as Record<string, unknown>;
}

export function assertNoPlaintextSecrets(
  value: Record<string, unknown>,
  path = "config"
): void {
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new InvalidConnectedAccountError(
        `${childPath} cannot store plaintext OAuth secrets`
      );
    }
    if (child && typeof child === "object" && !Array.isArray(child)) {
      assertNoPlaintextSecrets(child as Record<string, unknown>, childPath);
    }
  }
}

function readStringList(
  value: unknown,
  options?: { fallback?: string[] }
): string[] {
  if (!Array.isArray(value)) {
    return options?.fallback ? [...options.fallback] : [];
  }
  return [...new Set(value.filter(isNonEmptyString).map((entry) => entry.trim()))];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

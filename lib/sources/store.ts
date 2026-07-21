import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Source, SourceRule, SourceRun } from "@/lib/db/schema";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import { isUuid, normalizeUuid } from "@/lib/projects";
import type {
  SourceConfig,
  SupportedConnectedAccountProvider,
  SupportedSourceKind,
  SupportedSourceRuleType,
} from "./contracts";
import {
  InvalidConnectedAccountError,
  InvalidSourceError,
  SourceHasDeletionMarkersError,
  planNextSourceRule,
  runtimeForSourceKind,
  summarizeActiveSourceRules,
  verifyConnectedAccountOwnership,
  verifySourceOwnership,
} from "./contracts";

export type CreateConnectedAccountInput = {
  provider: SupportedConnectedAccountProvider;
  accountKey: string;
  label?: string | null;
};

export type ConnectedAccountSummary = {
  id: string;
  provider: string;
  accountKey: string;
  label: string | null;
  status: string;
  lastHealthyAt: Date | null;
  lastError: string | null;
  createdAt: Date;
};

export type CreateSourceRuleInput = {
  ruleType: SupportedSourceRuleType;
  config: Record<string, unknown>;
  enabled?: boolean;
};

export type CreateSourceInput = {
  projectId: string;
  kind: SupportedSourceKind;
  name: string;
  config: SourceConfig;
  cron: string | null;
  connectedAccountId?: string | null;
  initialRule?: CreateSourceRuleInput | null;
};

export type SourceDetail = {
  source: Source;
  connectedAccount: ConnectedAccountSummary | null;
  rules: SourceRule[];
  activeRules: Partial<Record<SupportedSourceRuleType, SourceRule>>;
  recentRuns: SourceRun[];
  originalCount: number;
};

export async function listConnectedAccounts(
  userId: string
): Promise<ConnectedAccountSummary[]> {
  return db
    .select({
      id: schema.connectedAccount.id,
      provider: schema.connectedAccount.provider,
      accountKey: schema.connectedAccount.accountKey,
      label: schema.connectedAccount.label,
      status: schema.connectedAccount.status,
      lastHealthyAt: schema.connectedAccount.lastHealthyAt,
      lastError: schema.connectedAccount.lastError,
      createdAt: schema.connectedAccount.createdAt,
    })
    .from(schema.connectedAccount)
    .where(eq(schema.connectedAccount.userId, userId))
    .orderBy(desc(schema.connectedAccount.createdAt));
}

export async function createConnectedAccount(
  userId: string,
  input: CreateConnectedAccountInput
): Promise<ConnectedAccountSummary> {
  const [account] = await db
    .insert(schema.connectedAccount)
    .values({
      userId,
      provider: input.provider,
      accountKey: input.accountKey,
      label: input.label ?? null,
      config: {},
      status: "active",
    })
    .onConflictDoUpdate({
      target: [
        schema.connectedAccount.userId,
        schema.connectedAccount.provider,
        schema.connectedAccount.accountKey,
      ],
      set: { label: input.label ?? null },
    })
    .returning({
      id: schema.connectedAccount.id,
      provider: schema.connectedAccount.provider,
      accountKey: schema.connectedAccount.accountKey,
      label: schema.connectedAccount.label,
      status: schema.connectedAccount.status,
      lastHealthyAt: schema.connectedAccount.lastHealthyAt,
      lastError: schema.connectedAccount.lastError,
      createdAt: schema.connectedAccount.createdAt,
    });
  return account;
}

export async function requireConnectedAccountId(
  userId: string,
  connectedAccountId?: unknown
): Promise<string | null> {
  if (connectedAccountId == null || connectedAccountId === "") return null;
  if (!isUuid(connectedAccountId)) {
    throw new InvalidConnectedAccountError();
  }

  const rows = await db
    .select({
      id: schema.connectedAccount.id,
      userId: schema.connectedAccount.userId,
    })
    .from(schema.connectedAccount)
    .where(eq(schema.connectedAccount.id, normalizeUuid(connectedAccountId)))
    .limit(1);

  return verifyConnectedAccountOwnership(userId, connectedAccountId, rows[0]);
}

export async function listSources(
  userId: string,
  projectId: string
): Promise<Source[]> {
  return db
    .select()
    .from(schema.source)
    .where(
      and(eq(schema.source.userId, userId), eq(schema.source.projectId, projectId))
    )
    .orderBy(desc(schema.source.createdAt));
}

export async function getOwnedSource(
  userId: string,
  sourceId: string,
  projectId: string
): Promise<Source> {
  if (!isUuid(sourceId)) throw new InvalidSourceError();

  const rows = await db
    .select()
    .from(schema.source)
    .where(eq(schema.source.id, normalizeUuid(sourceId)))
    .limit(1);

  const source = rows[0];
  verifySourceOwnership(userId, projectId, source);
  return source;
}

export async function createSource(
  userId: string,
  input: CreateSourceInput
): Promise<Source> {
  const connectedAccountId = await requireConnectedAccountId(
    userId,
    input.connectedAccountId
  );

  return db.transaction(async (tx) => {
    const [source] = await tx
      .insert(schema.source)
      .values({
        userId,
        projectId: input.projectId,
        connectedAccountId,
        kind: input.kind,
        name: input.name,
        config: input.config,
        runtime: runtimeForSourceKind(input.kind),
        cron: input.cron,
        enabled: true,
        nextRunAt: input.cron ? nextRunFromCron(input.cron) : null,
      })
      .returning();

    if (input.initialRule) {
      await tx.insert(schema.sourceRule).values({
        userId,
        projectId: input.projectId,
        sourceId: source.id,
        version: 1,
        ruleType: input.initialRule.ruleType,
        config: input.initialRule.config,
        enabled: input.initialRule.enabled ?? true,
      });
    }

    return source;
  });
}

export async function addSourceRule(
  userId: string,
  sourceId: string,
  projectId: string,
  input: CreateSourceRuleInput
): Promise<SourceRule> {
  const source = await getOwnedSource(userId, sourceId, projectId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const existingRules = await tx
          .select({
            id: schema.sourceRule.id,
            version: schema.sourceRule.version,
            ruleType: schema.sourceRule.ruleType,
            enabled: schema.sourceRule.enabled,
          })
          .from(schema.sourceRule)
          .where(eq(schema.sourceRule.sourceId, source.id));

        const plan = planNextSourceRule(
          existingRules,
          input.ruleType,
          input.enabled ?? true
        );

        if (plan.deactivateRuleIds.length > 0) {
          await tx
            .update(schema.sourceRule)
            .set({ enabled: false })
            .where(inArray(schema.sourceRule.id, plan.deactivateRuleIds));
        }

        const [rule] = await tx
          .insert(schema.sourceRule)
          .values({
            userId,
            projectId: source.projectId,
            sourceId: source.id,
            version: plan.nextVersion,
            ruleType: input.ruleType,
            config: input.config,
            enabled: input.enabled ?? true,
          })
          .returning();

        return rule;
      });
    } catch (error) {
      const conflict = error as { code?: string; constraint?: string };
      if (
        conflict.code !== "23505" ||
        conflict.constraint !== "source_rule_source_version_idx" ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }

  throw new Error("source rule version allocation failed");
}

export async function getSourceDetail(
  userId: string,
  sourceId: string,
  projectId: string
): Promise<SourceDetail> {
  const source = await getOwnedSource(userId, sourceId, projectId);

  const [connectedAccount, rules, recentRuns, originalCountRow] =
    await Promise.all([
      source.connectedAccountId
        ? db
            .select({
              id: schema.connectedAccount.id,
              provider: schema.connectedAccount.provider,
              accountKey: schema.connectedAccount.accountKey,
              label: schema.connectedAccount.label,
              status: schema.connectedAccount.status,
              lastHealthyAt: schema.connectedAccount.lastHealthyAt,
              lastError: schema.connectedAccount.lastError,
              createdAt: schema.connectedAccount.createdAt,
            })
            .from(schema.connectedAccount)
            .where(
              and(
                eq(schema.connectedAccount.id, source.connectedAccountId),
                eq(schema.connectedAccount.userId, userId)
              )
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      db
        .select()
        .from(schema.sourceRule)
        .where(eq(schema.sourceRule.sourceId, source.id))
        .orderBy(desc(schema.sourceRule.version)),
      db
        .select()
        .from(schema.sourceRun)
        .where(eq(schema.sourceRun.sourceId, source.id))
        .orderBy(desc(schema.sourceRun.startedAt))
        .limit(10),
      db
        .select({ c: count() })
        .from(schema.originalRecord)
        .where(eq(schema.originalRecord.sourceId, source.id))
        .limit(1),
    ]);

  return {
    source,
    connectedAccount,
    rules,
    activeRules: summarizeActiveSourceRules(rules),
    recentRuns,
    originalCount: originalCountRow[0]?.c ?? 0,
  };
}

export async function deleteSource(
  userId: string,
  sourceId: string,
  projectId: string
): Promise<void> {
  const source = await getOwnedSource(userId, sourceId, projectId);

  const marker = await db
    .select({ id: schema.deletionMarker.id })
    .from(schema.deletionMarker)
    .where(eq(schema.deletionMarker.sourceId, source.id))
    .limit(1);
  if (marker.length > 0) throw new SourceHasDeletionMarkersError();

  try {
    await db.delete(schema.source).where(eq(schema.source.id, source.id));
  } catch (error) {
    const dbError = error as { code?: string; constraint?: string };
    if (
      dbError.code === "23503" &&
      dbError.constraint === "deletion_marker_source_id_source_id_fk"
    ) {
      throw new SourceHasDeletionMarkersError();
    }
    throw error;
  }
}

export async function setSourceEnabled(
  userId: string,
  sourceId: string,
  projectId: string,
  enabled: boolean
): Promise<Source> {
  const source = await getOwnedSource(userId, sourceId, projectId);

  const [updated] = await db
    .update(schema.source)
    .set({
      enabled,
      nextRunAt: enabled && source.cron ? nextRunFromCron(source.cron) : null,
    })
    .where(eq(schema.source.id, source.id))
    .returning();

  return updated;
}

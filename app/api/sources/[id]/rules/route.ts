import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidSourceError,
  InvalidSourceRuleError,
  isSupportedSourceRuleType,
  readJsonObject,
} from "@/lib/sources/contracts";
import { parseReviewRuleConfig } from "@/lib/sources/review-rules";
import { sourceRuleDeps } from "./deps";

async function resolveProjectId(
  userId: string,
  provided: unknown
): Promise<string> {
  if (typeof provided !== "string" || !provided) {
    throw new InvalidProjectError("projectId is required");
  }
  return sourceRuleDeps.requireProjectId(userId, provided);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await sourceRuleDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ruleType = body.ruleType ?? "selection";
  if (!isSupportedSourceRuleType(ruleType)) {
    return NextResponse.json(
      { error: `unsupported rule type "${String(ruleType)}"` },
      { status: 400 }
    );
  }

  let config: Record<string, unknown>;
  try {
    config = readJsonObject(body.config, "config must be an object");
    // Review rules gate ingestion, so their config is validated and normalized
    // to the stored shape rather than accepted opaquely.
    if (ruleType === "review") {
      config = parseReviewRuleConfig(config) as unknown as Record<string, unknown>;
    }
  } catch (error) {
    if (error instanceof InvalidSourceRuleError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    const rule = await sourceRuleDeps.addSourceRule(
      userId,
      id,
      await resolveProjectId(userId, body.projectId),
      {
        ruleType,
        config,
        enabled: body.enabled === false ? false : true,
      }
    );
    return NextResponse.json({ rule });
  } catch (error) {
    if (error instanceof InvalidProjectError || error instanceof InvalidSourceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

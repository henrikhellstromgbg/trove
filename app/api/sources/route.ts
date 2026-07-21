import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidConnectedAccountError,
  InvalidSourceRuleError,
  buildSourceConfig,
  isSupportedSourceKind,
  isSupportedSourceRuleType,
  readJsonObject,
} from "@/lib/sources/contracts";
import { isCronValid } from "@/lib/pipelines/cron";
import { sourceDeps } from "./deps";

export async function GET(req: NextRequest) {
  const { userId } = await sourceDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectIdParam = req.nextUrl.searchParams.get("projectId") ?? undefined;
  if (!projectIdParam) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const projectId = await sourceDeps.requireProjectId(userId, projectIdParam);
    const sources = await sourceDeps.listSources(userId, projectId);
    return NextResponse.json({ sources });
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await sourceDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = body.kind;
  if (!isSupportedSourceKind(kind)) {
    return NextResponse.json(
      { error: `unsupported source kind "${String(kind ?? "")}"` },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (typeof body.projectId !== "string" || !body.projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const configResult = buildSourceConfig(kind, body);
  if ("error" in configResult) {
    return NextResponse.json({ error: configResult.error }, { status: 400 });
  }

  const cron = typeof body.cron === "string" ? body.cron.trim() : "0 * * * *";
  if (!isCronValid(cron)) {
    return NextResponse.json({ error: "cron is invalid" }, { status: 400 });
  }

  let initialRule:
    | {
        ruleType: "selection" | "review";
        config: Record<string, unknown>;
        enabled?: boolean;
      }
    | undefined;

  if (body.initialRule != null) {
    let rawRule: Record<string, unknown>;
    try {
      rawRule = readJsonObject(body.initialRule, "initialRule must be an object");
    } catch (error) {
      if (error instanceof InvalidSourceRuleError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const ruleType = rawRule.ruleType ?? "selection";
    if (!isSupportedSourceRuleType(ruleType)) {
      return NextResponse.json(
        { error: `unsupported rule type "${String(ruleType)}"` },
        { status: 400 }
      );
    }

    let ruleConfig: Record<string, unknown>;
    try {
      ruleConfig = readJsonObject(rawRule.config, "initialRule.config must be an object");
    } catch (error) {
      if (error instanceof InvalidSourceRuleError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    initialRule = {
      ruleType,
      config: ruleConfig,
      enabled: rawRule.enabled === false ? false : true,
    };
  }

  try {
    const projectId = await sourceDeps.requireProjectId(userId, body.projectId);
    const source = await sourceDeps.createSource(userId, {
      projectId,
      kind,
      name,
      config: configResult.config,
      cron,
      connectedAccountId:
        typeof body.connectedAccountId === "string" ? body.connectedAccountId : null,
      initialRule,
    });
    return NextResponse.json({ id: source.id, source });
  } catch (error) {
    if (
      error instanceof InvalidProjectError ||
      error instanceof InvalidConnectedAccountError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

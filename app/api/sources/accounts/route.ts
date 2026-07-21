import { NextRequest, NextResponse } from "next/server";
import {
  InvalidConnectedAccountError,
  isSupportedConnectedAccountProvider,
} from "@/lib/sources/contracts";
import { sourceAccountDeps } from "./deps";

export async function GET() {
  const { userId } = await sourceAccountDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await sourceAccountDeps.listConnectedAccounts(userId);
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const { userId } = await sourceAccountDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isSupportedConnectedAccountProvider(body.provider)) {
    return NextResponse.json(
      { error: `unsupported provider "${String(body.provider ?? "")}"` },
      { status: 400 }
    );
  }

  const accountKey =
    typeof body.accountKey === "string" ? body.accountKey.trim() : "";
  if (!accountKey) {
    return NextResponse.json({ error: "accountKey is required" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (body.config != null) {
    return NextResponse.json(
      { error: "connected account credentials are not accepted by this endpoint" },
      { status: 400 }
    );
  }

  try {
    const account = await sourceAccountDeps.createConnectedAccount(userId, {
      provider: body.provider,
      accountKey,
      label: label || null,
    });
    return NextResponse.json({ account });
  } catch (error) {
    if (error instanceof InvalidConnectedAccountError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

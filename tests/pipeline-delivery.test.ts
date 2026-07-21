import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  pipelineEmailDeps,
  sendPipelineEmail,
  type PipelineEmailMessage,
} from "@/lib/pipelines/email";
import {
  PIPELINE_RUN_COMPLETED,
  PIPELINE_RUN_DELIVERY_ERROR,
  runStatusForOutput,
  type PipelineSpec,
} from "@/lib/pipelines/types";

type MutableDeps = Record<string, unknown>;

const originalEmailDeps = { ...pipelineEmailDeps };
const AT = new Date("2026-07-21T12:00:00.000Z");

const SPEC: PipelineSpec = {
  name: "Weekly summary",
  cron: "0 15 * * 5",
  filter: {},
  prompt: "Summarize the week for me.",
  outputShape: "text",
  deliverByEmail: true,
  retrieval: false,
  includeForgotten: false,
};

const OUTPUT = { shape: "text", text: "Here is your week." } as const;

beforeEach(() => {
  Object.assign(pipelineEmailDeps as unknown as MutableDeps, originalEmailDeps, {
    now: () => AT,
  });
});

afterEach(() => {
  Object.assign(pipelineEmailDeps as unknown as MutableDeps, originalEmailDeps);
});

test("a successful send is recorded as sent with the recipient", async () => {
  let delivered: PipelineEmailMessage | null = null;
  Object.assign(pipelineEmailDeps as unknown as MutableDeps, {
    resolveRecipient: async () => "henrik@example.com",
    deliver: async (message: PipelineEmailMessage) => {
      delivered = message;
      return {};
    },
  });

  const delivery = await sendPipelineEmail("user-a", SPEC, OUTPUT);

  assert.equal(delivery.status, "sent");
  assert.equal(delivery.recipient, "henrik@example.com");
  assert.equal(delivery.attempted, true);
  assert.equal(delivery.error, undefined);
  assert.equal(delivery.at, AT.toISOString());
  assert.equal(delivered!.to, "henrik@example.com");
  assert.equal(delivered!.subject, "Weekly summary");
});

test("a provider error is recorded, not thrown", async () => {
  Object.assign(pipelineEmailDeps as unknown as MutableDeps, {
    resolveRecipient: async () => "henrik@example.com",
    deliver: async () => ({ error: "domain not verified" }),
  });

  const delivery = await sendPipelineEmail("user-a", SPEC, OUTPUT);

  assert.equal(delivery.status, "failed");
  assert.equal(delivery.recipient, "henrik@example.com");
  assert.match(delivery.error ?? "", /domain not verified/);
});

test("a thrown delivery error is captured as failed", async () => {
  Object.assign(pipelineEmailDeps as unknown as MutableDeps, {
    resolveRecipient: async () => "henrik@example.com",
    deliver: async () => {
      throw new Error("network down");
    },
  });

  const delivery = await sendPipelineEmail("user-a", SPEC, OUTPUT);

  assert.equal(delivery.status, "failed");
  assert.equal(delivery.error, "network down");
});

test("a missing recipient fails without attempting delivery", async () => {
  let deliverCalls = 0;
  Object.assign(pipelineEmailDeps as unknown as MutableDeps, {
    resolveRecipient: async () => null,
    deliver: async () => {
      deliverCalls += 1;
      return {};
    },
  });

  const delivery = await sendPipelineEmail("user-a", SPEC, OUTPUT);

  assert.equal(delivery.status, "failed");
  assert.equal(delivery.recipient, null);
  assert.equal(deliverCalls, 0);
});

test("run status downgrades only on a failed delivery", () => {
  assert.equal(
    runStatusForOutput({ delivery: { attempted: true, status: "sent", recipient: "x" } }),
    PIPELINE_RUN_COMPLETED
  );
  assert.equal(
    runStatusForOutput({ delivery: { attempted: false, status: "skipped", recipient: null } }),
    PIPELINE_RUN_COMPLETED
  );
  assert.equal(runStatusForOutput({}), PIPELINE_RUN_COMPLETED);
  assert.equal(
    runStatusForOutput({
      delivery: { attempted: true, status: "failed", recipient: "x", error: "boom" },
    }),
    PIPELINE_RUN_DELIVERY_ERROR
  );
});

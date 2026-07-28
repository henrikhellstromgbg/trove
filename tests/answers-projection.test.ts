import assert from "node:assert/strict";
import { test } from "node:test";
import { projectAnswer, type AnswerMessage } from "@/lib/answers";

const createdAt = new Date("2026-07-26T10:00:00Z");
const conversation = { id: "answer-1", title: "Saved title", createdAt };

function message(
  role: string,
  content: string,
  minute: number,
  citations: unknown = null
): AnswerMessage {
  return {
    role,
    content,
    citations,
    createdAt: new Date(`2026-07-26T10:${String(minute).padStart(2, "0")}:00Z`),
  };
}

test("the latest complete assistant response is the canonical answer", () => {
  const firstCitation = [{ n: 1, itemId: "item-1", title: "First", source: null }];
  const latestCitation = [{ n: 1, itemId: "item-2", title: "Latest", source: "https://example.com/a" }];
  const answer = projectAnswer(conversation, [
    message("user", "First question", 1),
    message("assistant", "First answer", 2, firstCitation),
    message("user", "Refine it", 3),
    message("assistant", "Latest answer", 4, latestCitation),
  ]);

  assert.equal(answer.answer, "Latest answer");
  assert.deepEqual(answer.citations, latestCitation);
  assert.equal(answer.activity.length, 1);
  assert.equal(answer.activity[0].answer, "First answer");
  assert.equal(answer.updatedAt.toISOString(), "2026-07-26T10:04:00.000Z");
});

test("an incomplete trailing question never replaces the complete answer", () => {
  const answer = projectAnswer(conversation, [
    message("user", "First question", 1),
    message("assistant", "Stable answer", 2, []),
    message("user", "Failed follow-up", 5),
  ]);

  assert.equal(answer.answer, "Stable answer");
  assert.equal(answer.activity.length, 0);
  assert.equal(answer.updatedAt.toISOString(), "2026-07-26T10:05:00.000Z");
});

test("legacy conversations without a complete answer remain listable", () => {
  const answer = projectAnswer(
    { ...conversation, title: null },
    [message("user", "A useful title", 1)]
  );

  assert.equal(answer.title, "A useful title");
  assert.equal(answer.answer, null);
  assert.deepEqual(answer.citations, []);
});

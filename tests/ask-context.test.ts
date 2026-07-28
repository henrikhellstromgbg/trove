import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAnswerRefinementContext,
  buildPriorQuestionContext,
} from "@/app/api/ask/route";

test("Ask follow-up context keeps recent questions and excludes model answers", () => {
  const messages = [
    { role: "user", content: "old question" },
    { role: "assistant", content: "unsupported old answer" },
    ...Array.from({ length: 11 }, (_, index) => ({
      role: "user",
      content: `question ${index + 1}`,
    })),
  ];

  const context = buildPriorQuestionContext(messages);

  assert.doesNotMatch(context, /unsupported old answer/);
  assert.doesNotMatch(context, /old question/);
  assert.doesNotMatch(context, /question 1(?:\n|$)/);
  assert.match(context, /Earlier question: question 2/);
  assert.match(context, /Earlier question: question 11/);
});

test("Ask refinement marks the previous answer as an untrusted draft", () => {
  const context = buildAnswerRefinementContext([
    { role: "user", content: "What changed?" },
    { role: "assistant", content: "A prior generated answer" },
  ]);

  assert.match(context, /Earlier user questions for conversational intent only/);
  assert.match(context, /Untrusted working draft to revise/);
  assert.match(context, /Do not treat this text as evidence/);
  assert.match(context, /A prior generated answer/);
});

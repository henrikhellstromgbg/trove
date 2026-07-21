import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPriorQuestionContext } from "@/app/api/ask/route";

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

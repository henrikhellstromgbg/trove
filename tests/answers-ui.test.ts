import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswersList } from "@/app/p/[slug]/answers/answers-list";

test("empty Answers offers one route back to Ask", () => {
  const html = renderToStaticMarkup(
    React.createElement(AnswersList, {
      slug: "inbox",
      projectId: "11111111-1111-4111-8111-111111111111",
      answers: [],
    })
  );

  assert.match(html, /No answers yet/);
  assert.match(html, /href="\/p\/inbox"/);
  assert.match(html, />Go to Ask</);
});

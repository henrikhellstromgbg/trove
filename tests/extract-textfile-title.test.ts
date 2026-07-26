import assert from "node:assert/strict";
import { test } from "node:test";

import { selectTextFileTitle } from "@/lib/ai/extract-textfile";

test("structured text files use the full filename as their title", () => {
  const cases = [
    ["records.json", '[\n  { "id": 1 }\n]'],
    ["records.csv", "id,name\n1,Ada"],
    ["records.tsv", "id\tname\n1\tAda"],
    ["records.xml", "<?xml version=\"1.0\"?>\n<records />"],
    ["records.yaml", "records:\n  - id: 1"],
    ["records.yml", "records:\n  - id: 1"],
    ["records.html", "<!doctype html>\n<title>Records</title>"],
    ["records.log", "2026-07-26 started"],
  ] as const;

  for (const [filename, text] of cases) {
    assert.equal(selectTextFileTitle(text, filename), filename);
  }
});

test("prose text files keep a useful first-line title", () => {
  assert.equal(
    selectTextFileTitle("\n# Research notes\nDetails", "notes.md"),
    "# Research notes"
  );
  assert.equal(
    selectTextFileTitle("Meeting notes\nDetails", "notes.txt"),
    "Meeting notes"
  );
});

test("empty prose files fall back to the filename without its extension", () => {
  assert.equal(selectTextFileTitle("  \n", "empty.markdown"), "empty");
  assert.equal(selectTextFileTitle("", ""), "Untitled note");
});

test("titles are limited to 120 characters", () => {
  assert.equal(
    selectTextFileTitle("x".repeat(130), "notes.txt"),
    "x".repeat(120)
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  captureFilesFromList,
  formatCaptureUploadStatus,
  uploadCaptureFiles,
} from "@/lib/capture-upload";

test("file-list conversion keeps every selected or globally dropped file", () => {
  const files = [
    new File(["one"], "one.txt", { type: "text/plain" }),
    new File(["two"], "two.txt", { type: "text/plain" }),
    new File(["three"], "three.txt", { type: "text/plain" }),
  ];

  assert.deepEqual(captureFilesFromList(files).map((file) => file.name), [
    "one.txt",
    "two.txt",
    "three.txt",
  ]);
});

test("multi-file capture submits every file sequentially with progress", async () => {
  const files = [
    new File(["one"], "one.txt", { type: "text/plain" }),
    new File(["two"], "two.json", { type: "application/json" }),
  ];
  const requestedNames: string[] = [];
  const progress: string[] = [];
  let active = 0;
  let maxActive = 0;

  const results = await uploadCaptureFiles(
    files,
    "project-1",
    async (_input, init) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const form = init?.body as FormData;
      requestedNames.push((form.get("file") as File).name);
      await Promise.resolve();
      active -= 1;
      return Response.json({ id: `item-${requestedNames.length}`, status: "pending" });
    },
    (completed, total) => progress.push(`${completed}/${total}`)
  );

  assert.deepEqual(requestedNames, ["one.txt", "two.json"]);
  assert.equal(maxActive, 1);
  assert.deepEqual(progress, ["1/2", "2/2"]);
  assert.deepEqual(results.map((result) => result.outcome), ["saved", "saved"]);
  assert.equal(formatCaptureUploadStatus(results), "2 files saved");
});

test("multi-file capture exposes duplicates and retains request errors", async () => {
  const files = [
    new File(["same"], "same.txt", { type: "text/plain" }),
    new File(["bad"], "bad.bin", { type: "application/octet-stream" }),
  ];

  const results = await uploadCaptureFiles(files, "project-1", async (_input, init) => {
    const filename = ((init?.body as FormData).get("file") as File).name;
    if (filename === "same.txt") {
      return Response.json(
        { error: "File already exists", duplicate: true },
        { status: 409 }
      );
    }
    return Response.json({ error: "unsupported file type" }, { status: 400 });
  });

  assert.deepEqual(results.map((result) => result.outcome), ["duplicate", "error"]);
  assert.equal(
    formatCaptureUploadStatus(results),
    "File already exists: same.txt · bad.bin: unsupported file type"
  );
});

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  storeUpload,
  readUploadBuffer,
  readUploadText,
  deleteUpload,
  contentTypeForKey,
} from "@/lib/files";
import { GET, itemBlobDeps } from "@/app/api/items/[id]/blob/route";

type MutableDeps = Record<string, unknown>;

let dir: string;
const prevDir = process.env.TROVE_FILES_DIR;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "trove-files-"));
  process.env.TROVE_FILES_DIR = dir;
});

afterEach(() => {
  if (prevDir === undefined) delete process.env.TROVE_FILES_DIR;
  else process.env.TROVE_FILES_DIR = prevDir;
  rmSync(dir, { recursive: true, force: true });
});

test("storeUpload round-trips and names files {uuid}-{sanitized}", async () => {
  const { key } = await storeUpload("My Report (v2).pdf", Buffer.from("PDF"));
  // uuid prefix + sanitized, browsable original name; no unsafe chars.
  assert.match(key, /^[0-9a-f-]{36}-My_Report__v2_\.pdf$/);
  assert.equal((await readUploadBuffer(key)).toString(), "PDF");
  assert.equal(await readUploadText(key), "PDF");
});

test("deleteUpload removes the file, then reports it gone", async () => {
  const { key } = await storeUpload("note.txt", Buffer.from("hi"));
  assert.equal(await deleteUpload(key), true);
  assert.equal(await deleteUpload(key), false);
  await assert.rejects(() => readUploadBuffer(key));
});

test("keys that try to escape the directory are rejected", async () => {
  await assert.rejects(() => readUploadBuffer("../secret"), /Invalid file key/);
  await assert.rejects(() => readUploadBuffer("a/b"), /Invalid file key/);
});

test("contentTypeForKey infers from extension", () => {
  assert.match(contentTypeForKey("x-y.pdf"), /application\/pdf/);
  assert.match(contentTypeForKey("x-y.PNG"), /image\/png/);
  assert.match(contentTypeForKey("x-y.txt"), /text\/plain/);
  assert.equal(contentTypeForKey("x-y.bin"), "application/octet-stream");
});

// --- Serve route (ownership-checked) ---

const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const originalDeps = { ...itemBlobDeps };

afterEach(() => {
  Object.assign(itemBlobDeps as unknown as MutableDeps, originalDeps);
});

function serveReq() {
  return new NextRequest(
    `http://localhost/api/items/${ITEM_ID}/blob?projectId=${PROJECT_ID}`
  );
}

test("serve route streams an owned item's file with inferred headers", async () => {
  const { key } = await storeUpload("report.pdf", Buffer.from("PDFDATA"));
  Object.assign(itemBlobDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: "user-a" }),
    requireProjectId: async () => PROJECT_ID,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ blobUrl: key, source: "report.pdf" }],
          }),
        }),
      }),
    },
  });

  const res = await GET(serveReq(), { params: Promise.resolve({ id: ITEM_ID }) });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/pdf/);
  assert.match(res.headers.get("content-disposition") ?? "", /report\.pdf/);
  assert.equal(await res.text(), "PDFDATA");
});

test("serve route 404s when the file is missing on disk", async () => {
  Object.assign(itemBlobDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: "user-a" }),
    requireProjectId: async () => PROJECT_ID,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ blobUrl: "missing-key.pdf", source: "x.pdf" }],
          }),
        }),
      }),
    },
  });

  const res = await GET(serveReq(), { params: Promise.resolve({ id: ITEM_ID }) });
  assert.equal(res.status, 404);
});

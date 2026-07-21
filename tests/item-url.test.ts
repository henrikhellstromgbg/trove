import assert from "node:assert/strict";
import test from "node:test";
import { itemOriginalUrl } from "../lib/item-url";

test("itemOriginalUrl keeps external sources external", () => {
  assert.equal(
    itemOriginalUrl({
      id: "item-1",
      projectId: "project-1",
      source: "https://example.com/post",
      blobUrl: null,
    }),
    "https://example.com/post"
  );
});

test("itemOriginalUrl routes private blobs through the authenticated proxy", () => {
  assert.equal(
    itemOriginalUrl({
      id: "item-1",
      projectId: "11111111-1111-4111-8111-111111111111",
      source: "notes.pdf",
      blobUrl: "https://private.example",
    }),
    "/api/items/item-1/blob?projectId=11111111-1111-4111-8111-111111111111"
  );
});

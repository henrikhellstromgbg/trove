import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { GET, itemBlobDeps } from "@/app/api/items/[id]/blob/route";
import { InvalidProjectError } from "@/lib/projects";

type MutableDeps = Record<string, unknown>;

const originalDeps = { ...itemBlobDeps };
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  Object.assign(itemBlobDeps as unknown as MutableDeps, originalDeps);
});

test("item blob route requires an explicit owned project before reading the item", async () => {
  let selected = false;
  Object.assign(itemBlobDeps as unknown as MutableDeps, {
    auth: async () => ({ userId: "user-a" }),
    requireProjectId: async () => {
      throw new InvalidProjectError();
    },
    db: {
      select: () => {
        selected = true;
        throw new Error("database should not be read");
      },
    },
  });

  const response = await GET(
    new NextRequest(
      `http://localhost/api/items/${ITEM_ID}/blob?projectId=11111111-1111-4111-8111-111111111111`
    ),
    { params: Promise.resolve({ id: ITEM_ID }) }
  );

  assert.equal(response.status, 400);
  assert.equal(selected, false);
});

import assert from "node:assert/strict";
import { test } from "node:test";

// Side-effect import: proves the workspace package resolves to TypeScript source.
import "@fquiz/common";

test("test runner loads TypeScript", () => {
  assert.equal(1 + 1, 2);
});

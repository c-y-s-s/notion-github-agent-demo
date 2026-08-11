import assert from "node:assert/strict";
import test from "node:test";
import { extractSafeCodePaths, inferFallbackPaths } from "../lib/repository-context";

test("extracts code paths and blocks sensitive or escaping paths", () => {
  const paths = extractSafeCodePaths("Change app/page.tsx and tests/page.test.ts, never read ../secret.ts or config/.env.json or keys/token.json");
  assert.deepEqual(paths, ["app/page.tsx", "tests/page.test.ts"]);
});

test("uses bounded entry points when an issue names a UI area but no files", () => {
  assert.deepEqual(inferFallbackPaths("Dashboard project filter does not work"), ["app/page.tsx", "app/globals.css"]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { mapIssueWorkType } from "../lib/github-sync";

test("maps GitHub labels to Notion work types", () => {
  assert.equal(mapIssueWorkType(["bug", "demo-data"]), "Bug");
  assert.equal(mapIssueWorkType(["documentation"]), "Docs");
  assert.equal(mapIssueWorkType(["enhancement"]), "Feature");
  assert.equal(mapIssueWorkType([]), "Feature");
});

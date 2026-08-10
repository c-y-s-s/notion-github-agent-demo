import assert from "node:assert/strict";
import test from "node:test";
import { extractLinkedPullRequestUrls } from "../lib/github";

test("extracts and deduplicates pull requests cross-referenced from an issue", () => {
  const events = [
    { event:"cross-referenced", source:{ issue:{ html_url:"https://github.com/a/b/pull/12", pull_request:{ html_url:"https://github.com/a/b/pull/12" } } } },
    { event:"cross-referenced", source:{ issue:{ html_url:"https://github.com/a/b/pull/12", pull_request:{ html_url:"https://github.com/a/b/pull/12" } } } },
    { event:"cross-referenced", source:{ issue:{ html_url:"https://github.com/a/b/issues/13" } } },
  ];
  assert.deepEqual(extractLinkedPullRequestUrls(events), ["https://github.com/a/b/pull/12"]);
});

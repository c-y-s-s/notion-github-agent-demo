import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export async function evaluateBenchmarkCase(id:string, modulePath:string) {
  const subject = await import(`${pathToFileURL(modulePath).href}?run=${Date.now()}`);
  switch (id) {
    case "B01":
      assert.equal(subject.normalizeUsername("  Alice.SMITH  "), "alice.smith");
      assert.equal(subject.normalizeUsername("BOB"), "bob");
      break;
    case "B02":
      assert.deepEqual(subject.paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
      assert.deepEqual(subject.paginate([], 2), []);
      break;
    case "B03":
      assert.equal(subject.sumAmounts([0.1, 0.2]), 0.3);
      assert.equal(subject.sumAmounts([10.005, 0.005]), 10.01);
      break;
    case "B04":
      assert.equal(subject.parseBoolean("TRUE"), true);
      assert.equal(subject.parseBoolean(" false "), false);
      assert.equal(subject.parseBoolean(0), false);
      assert.throws(() => subject.parseBoolean("sometimes"));
      break;
    case "B05": {
      const records = [{ id:1, value:"first" }, { id:2, value:"second" }, { id:1, value:"last" }];
      assert.deepEqual(subject.uniqueById(records), records.slice(0, 2));
      break;
    }
    case "B06":
      assert.deepEqual(subject.retryDelays(1, 100), []);
      assert.deepEqual(subject.retryDelays(4, 100), [100, 200, 400]);
      break;
    case "B07":
      {
        const redacted = subject.redactTokens("Bearer abc, bearer DEF and BEARER ghi");
        assert.doesNotMatch(redacted, /\b(?:abc|def|ghi)\b/i);
        assert.equal((redacted.match(/\[REDACTED\]/g) || []).length, 3);
      }
      break;
    case "B08":
      assert.equal(subject.isWithinLimit(10, 10), true);
      assert.equal(subject.isWithinLimit(11, 10), false);
      break;
    case "B09": {
      const tasks = [{ id:"low", priority:2 }, { id:"high", priority:1 }];
      const snapshot = [...tasks];
      assert.deepEqual(subject.sortByPriority(tasks).map((task:{id:string}) => task.id), ["high", "low"]);
      assert.deepEqual(tasks, snapshot);
      break;
    }
    case "B10":
      assert.equal(subject.isSameUtcDay("2026-08-10T23:30:00-04:00", "2026-08-11T04:00:00Z"), true);
      assert.equal(subject.isSameUtcDay("2026-08-10T23:59:59Z", "2026-08-11T00:00:00Z"), false);
      break;
    default: throw new Error(`unknown_case:${id}`);
  }
}

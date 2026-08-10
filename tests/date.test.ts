import assert from "node:assert/strict";
import test from "node:test";
import { classifyTask, getWeekPeriod } from "../lib/date";

const period = getWeekPeriod(new Date("2026-08-10T04:00:00Z"), "Asia/Taipei");

test("computes a Monday-to-Sunday period", () => {
  assert.deepEqual(period, { today:"2026-08-10", start:"2026-08-10", end:"2026-08-16", timeZone:"Asia/Taipei" });
});

test("classifies weekly, overdue, completed, and no-due tasks", () => {
  assert.deepEqual(classifyTask({ dueRaw:"2026-08-12", completedAt:null, status:"未開始" }, period), ["due_this_week"]);
  assert.deepEqual(classifyTask({ dueRaw:"2026-08-09", completedAt:null, status:"執行中" }, period), ["overdue"]);
  assert.deepEqual(classifyTask({ dueRaw:"2026-08-09", completedAt:"2026-08-11", status:"已完成" }, period), ["completed_this_week"]);
  assert.deepEqual(classifyTask({ dueRaw:null, completedAt:null, status:"未開始" }, period), ["no_due"]);
});

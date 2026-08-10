export type ComputedTag = "due_this_week" | "completed_this_week" | "overdue" | "no_due";

function ymdInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function getWeekPeriod(now = new Date(), timeZone = "Asia/Taipei") {
  const today = ymdInTimeZone(now, timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = addDays(today, mondayOffset);
  return { today, start, end: addDays(start, 6), timeZone };
}

export function classifyTask(
  task: { dueRaw: string | null; completedAt: string | null; status: string },
  period = getWeekPeriod(),
): ComputedTag[] {
  const tags: ComputedTag[] = [];
  const due = task.dueRaw?.slice(0, 10) || null;
  const completed = task.completedAt?.slice(0, 10) || null;
  if (!due) tags.push("no_due");
  if (due && due >= period.start && due <= period.end) tags.push("due_this_week");
  if (completed && completed >= period.start && completed <= period.end) tags.push("completed_this_week");
  if (due && due < period.today && task.status !== "已完成") tags.push("overdue");
  return tags;
}

export function formatWeekLabel(period: { start:string; end:string }) {
  const short = (value:string) => `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;
  return `${short(period.start)}—${short(period.end)}`;
}

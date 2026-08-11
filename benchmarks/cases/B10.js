export function isSameUtcDay(left, right) {
  return new Date(left).toDateString() === new Date(right).toDateString();
}

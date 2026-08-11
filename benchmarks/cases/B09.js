export function sortByPriority(tasks) {
  return tasks.sort((left, right) => left.priority - right.priority);
}

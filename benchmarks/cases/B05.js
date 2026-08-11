export function uniqueById(records) {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

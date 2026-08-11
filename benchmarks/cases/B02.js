export function paginate(items, size) {
  const pages = [];
  for (let index = 0; index <= items.length; index += size) pages.push(items.slice(index, index + size - 1));
  return pages;
}

export function retryDelays(attempts, baseMs) {
  return Array.from({ length: attempts }, (_, index) => baseMs * 2 ** index);
}

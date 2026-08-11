export function redactTokens(text) {
  return text.replace(/Bearer\s+[^\s,]+/, "Bearer [REDACTED]");
}

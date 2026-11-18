/** The product's "features and benefits" lines as the admin typed them: trimmed, no empty lines, at most 20 lines of 200 characters. */
export function cleanFeatures(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map(line => String(line ?? '').trim().slice(0, 200)).filter(Boolean).slice(0, 20);
}

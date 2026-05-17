export function chunkText(text: string, target = 2000, overlap = 200): string[] {
  const clean = text.trim();
  if (clean.length <= target) return [clean];

  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + target));
    if (i + target >= clean.length) break;
    i += target - overlap;
  }
  return chunks;
}

// Deterministic pastel color from a string hash, used as a placeholder
// product "image" (colored initial swatch). Deliberate trade-off: no real
// product images are seeded/hosted, so rendering stays fully self-contained
// and offline-friendly rather than depending on an external image host at
// demo time. See README "Trade-offs".
export function swatchColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 55%)`;
}

/**
 * Sponsored slot positions, 1-indexed within the organic browse list:
 * 5, 10, 20, 40, 80, 160, ... — the gap doubles after the first one.
 * position(n) = 5 * 2^(n-1) for n = 1, 2, 3, ...
 *
 * These positions are against the GLOBAL organic item sequence (spanning
 * every page fetched so far in the current browse session), not reset per
 * page — otherwise the doubling pattern would break across page boundaries.
 * Only meaningful in browse mode; search mode never shows sponsored items.
 */

export interface SponsoredSlot {
  /** 1-indexed position within the organic list, e.g. 5, 10, 20, ... */
  position: number;
  /** 0-indexed slot number (n-1) — which sponsored item to show, deterministically. */
  slotIndex: number;
}

/** Every sponsored slot with startPosition <= position <= endPosition, ascending. Both bounds inclusive, 1-indexed. */
export function getSponsoredSlotsInRange(
  startPosition: number,
  endPosition: number,
): SponsoredSlot[] {
  const slots: SponsoredSlot[] = [];
  let position = 5;
  let slotIndex = 0;
  while (position <= endPosition) {
    if (position >= startPosition) slots.push({ position, slotIndex });
    position *= 2;
    slotIndex += 1;
  }
  return slots;
}

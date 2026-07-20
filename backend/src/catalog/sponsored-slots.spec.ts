import { getSponsoredSlotsInRange } from './sponsored-slots';

function positions(startPosition: number, endPosition: number): number[] {
  return getSponsoredSlotsInRange(startPosition, endPosition).map(
    (s) => s.position,
  );
}

describe('getSponsoredSlotsInRange', () => {
  it('returns nothing for a range entirely before the first slot', () => {
    expect(positions(1, 4)).toEqual([]);
  });

  it('includes the first slot exactly at position 5', () => {
    expect(positions(1, 5)).toEqual([5]);
  });

  it('returns multiple slots spanning the first several pages', () => {
    expect(positions(1, 50)).toEqual([5, 10, 20, 40]);
  });

  it("handles a range that doesn't start at position 1 and isn't slot-aligned", () => {
    // page 2 of size 5: positions 6-10 -> only 10 qualifies
    expect(positions(6, 10)).toEqual([10]);
  });

  it('handles a range that starts and ends between two slots', () => {
    expect(positions(21, 39)).toEqual([]);
  });

  it('is correct far out in the sequence (5 * 2^8 = 1280, next is 2560)', () => {
    expect(positions(1000, 2000)).toEqual([1280]);
  });

  it('includes both boundary slots when the range starts and ends exactly on slots', () => {
    expect(positions(10, 40)).toEqual([10, 20, 40]);
  });

  it('returns nothing when startPosition > endPosition (empty/degenerate range)', () => {
    expect(positions(10, 5)).toEqual([]);
  });

  it('handles a single-position range that is itself a slot', () => {
    expect(positions(20, 20)).toEqual([20]);
  });

  it('handles a single-position range that is not a slot', () => {
    expect(positions(21, 21)).toEqual([]);
  });

  it('assigns sequential, stable slotIndex values regardless of the queried range', () => {
    expect(getSponsoredSlotsInRange(1, 50)).toEqual([
      { position: 5, slotIndex: 0 },
      { position: 10, slotIndex: 1 },
      { position: 20, slotIndex: 2 },
      { position: 40, slotIndex: 3 },
    ]);
    // Same slot queried in isolation (e.g. a later page) still reports slotIndex 2, not 0.
    expect(getSponsoredSlotsInRange(20, 20)).toEqual([
      { position: 20, slotIndex: 2 },
    ]);
  });
});

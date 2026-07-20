/**
 * Opaque pagination cursor. Two shapes depending on mode — the client never
 * needs to know which; it just round-trips whatever nextCursor it was given.
 *
 * - browse mode: keyset on id (ASC) + the running count of organic items
 *   seen so far (needed to place sponsored slots at the correct GLOBAL
 *   position, since sponsored items are excluded from the count itself).
 * - search mode: plain offset. Search result sets are a filtered subset of
 *   the catalog and ranked by trigram similarity rather than id, so a
 *   simple OFFSET is used there instead of a keyset — see README "Search"
 *   for why this is an acceptable trade-off (much smaller result sets than
 *   the full unfiltered browse case that keyset pagination protects).
 */
export type Cursor =
  | { mode: 'browse'; lastId: number; position: number }
  | { mode: 'search'; offset: number };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

// Rejects negative values, not just non-integers: a negative offset/lastId/
// position reaching the SQL layer (e.g. `OFFSET -10`) would surface as a
// Postgres error (500) instead of the graceful "restart from the beginning"
// this function is meant to guarantee for any malformed cursor.
function isNonNegativeInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

export function decodeCursor(
  raw: string | undefined,
  mode: 'browse' | 'search',
): Cursor {
  if (!raw) {
    return mode === 'browse'
      ? { mode: 'browse', lastId: 0, position: 0 }
      : { mode: 'search', offset: 0 };
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );
    const candidate = parsed as Partial<Cursor> | null;
    if (
      mode === 'browse' &&
      candidate?.mode === 'browse' &&
      isNonNegativeInt(candidate.lastId) &&
      isNonNegativeInt(candidate.position)
    ) {
      return candidate as Cursor;
    }
    if (
      mode === 'search' &&
      candidate?.mode === 'search' &&
      isNonNegativeInt(candidate.offset)
    ) {
      return candidate as Cursor;
    }
  } catch {
    // fall through to default below
  }

  // Malformed or mode-mismatched cursor (e.g. client added a search query
  // mid-scroll) — restart from the beginning rather than 400, since a bad
  // cursor is recoverable and shouldn't hard-fail the request.
  return mode === 'browse'
    ? { mode: 'browse', lastId: 0, position: 0 }
    : { mode: 'search', offset: 0 };
}

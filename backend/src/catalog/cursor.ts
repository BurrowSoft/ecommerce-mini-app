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
export type Cursor = { mode: "browse"; lastId: number; position: number } | { mode: "search"; offset: number };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined, mode: "browse" | "search"): Cursor {
  if (!raw) {
    return mode === "browse" ? { mode: "browse", lastId: 0, position: 0 } : { mode: "search", offset: 0 };
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (mode === "browse" && parsed?.mode === "browse" && Number.isInteger(parsed.lastId) && Number.isInteger(parsed.position)) {
      return parsed as Cursor;
    }
    if (mode === "search" && parsed?.mode === "search" && Number.isInteger(parsed.offset)) {
      return parsed as Cursor;
    }
  } catch {
    // fall through to default below
  }

  // Malformed or mode-mismatched cursor (e.g. client added a search query
  // mid-scroll) — restart from the beginning rather than 400, since a bad
  // cursor is recoverable and shouldn't hard-fail the request.
  return mode === "browse" ? { mode: "browse", lastId: 0, position: 0 } : { mode: "search", offset: 0 };
}

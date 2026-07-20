import { encodeCursor, decodeCursor } from './cursor';

describe('cursor encode/decode', () => {
  it('round-trips a browse cursor', () => {
    const encoded = encodeCursor({ mode: 'browse', lastId: 42, position: 100 });
    expect(decodeCursor(encoded, 'browse')).toEqual({
      mode: 'browse',
      lastId: 42,
      position: 100,
    });
  });

  it('round-trips a search cursor', () => {
    const encoded = encodeCursor({ mode: 'search', offset: 60 });
    expect(decodeCursor(encoded, 'search')).toEqual({
      mode: 'search',
      offset: 60,
    });
  });

  it('defaults to the start of the list when no cursor is given (browse)', () => {
    expect(decodeCursor(undefined, 'browse')).toEqual({
      mode: 'browse',
      lastId: 0,
      position: 0,
    });
  });

  it('defaults to the start of the list when no cursor is given (search)', () => {
    expect(decodeCursor(undefined, 'search')).toEqual({
      mode: 'search',
      offset: 0,
    });
  });

  it('restarts from the beginning on a garbage cursor rather than throwing', () => {
    expect(decodeCursor('not-valid-base64url-json!!', 'browse')).toEqual({
      mode: 'browse',
      lastId: 0,
      position: 0,
    });
  });

  it("restarts from the beginning when the cursor's mode doesn't match the request (e.g. search query added mid-scroll)", () => {
    const browseCursor = encodeCursor({
      mode: 'browse',
      lastId: 42,
      position: 100,
    });
    expect(decodeCursor(browseCursor, 'search')).toEqual({
      mode: 'search',
      offset: 0,
    });
  });
});

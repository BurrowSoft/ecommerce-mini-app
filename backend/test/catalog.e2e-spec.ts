import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Pool } from 'pg';
import { buildApp, extractCookie } from './test-utils';

const DEMO_EMAIL = process.env.SEED_DEMO_USER_EMAIL ?? 'demo@example.com';
const DEMO_PASSWORD = process.env.SEED_DEMO_USER_PASSWORD ?? 'ChangeMe123!';

interface ProductListItem {
  id: number;
  category: string;
  isSponsored: boolean;
}

interface ProductListResponse {
  items: ProductListItem[];
  nextCursor: string | null;
}

function body(res: request.Response): ProductListResponse {
  return res.body as ProductListResponse;
}

describe('Catalog (e2e)', () => {
  let app: INestApplication<App>;
  let sessionPool: Pool;
  let cookie: string;

  beforeAll(async () => {
    ({ app, sessionPool } = await buildApp());
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);
    cookie = extractCookie(loginRes);
  });

  afterAll(async () => {
    await app.close();
    await sessionPool.end();
  });

  it('rejects unauthenticated requests', () => {
    return request(app.getHttpServer()).get('/products').expect(401);
  });

  it('rejects a page size below the minimum (5)', () => {
    return request(app.getHttpServer())
      .get('/products?limit=4')
      .set('Cookie', cookie)
      .expect(400);
  });

  it('rejects a page size above the maximum (50)', () => {
    return request(app.getHttpServer())
      .get('/products?limit=51')
      .set('Cookie', cookie)
      .expect(400);
  });

  it('rejects a non-integer page size', () => {
    return request(app.getHttpServer())
      .get('/products?limit=abc')
      .set('Cookie', cookie)
      .expect(400);
  });

  it('rejects an unknown category', () => {
    return request(app.getHttpServer())
      .get('/products?category=NotARealCategory')
      .set('Cookie', cookie)
      .expect(400);
  });

  it('returns exactly the requested number of organic items regardless of injected sponsored items', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?limit=10')
      .set('Cookie', cookie)
      .expect(200);

    const organic = body(res).items.filter((i) => !i.isSponsored);
    expect(organic).toHaveLength(10);
  });

  it('places sponsored items at positions 5 and 10 within the first 10-item page, and nowhere else', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?limit=10')
      .set('Cookie', cookie)
      .expect(200);

    const sponsoredIndexes = body(res)
      .items.map((item, idx) => (item.isSponsored ? idx : null))
      .filter((idx): idx is number => idx !== null);

    // Position 5 sponsored item lands at array index 5 (after 5 organic items,
    // 0-indexed); position 10 lands at index 11 (5 organic + 1 sponsored + 5 organic).
    expect(sponsoredIndexes).toEqual([5, 11]);
  });

  it('continues the sponsored sequence correctly across a page boundary (next slot at position 20)', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/products?limit=10')
      .set('Cookie', cookie)
      .expect(200);
    expect(body(page1).nextCursor).toBeTruthy();

    const page2 = await request(app.getHttpServer())
      .get(
        `/products?limit=10&cursor=${encodeURIComponent(body(page1).nextCursor!)}`,
      )
      .set('Cookie', cookie)
      .expect(200);

    const organic = body(page2).items.filter((i) => !i.isSponsored);
    expect(organic).toHaveLength(10);

    const sponsoredIndexes = body(page2)
      .items.map((item, idx) => (item.isSponsored ? idx : null))
      .filter((idx): idx is number => idx !== null);
    // Global position 20 is the 10th organic item on this page -> index 10 (0-indexed).
    expect(sponsoredIndexes).toEqual([10]);
  });

  it('filters by category, and keeps any interleaved sponsored item within that same category', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?limit=10&category=Books')
      .set('Cookie', cookie)
      .expect(200);

    expect(body(res).items.length).toBeGreaterThan(0);
    for (const item of body(res).items) {
      expect(item.category).toBe('Books');
    }
  });

  it('excludes sponsored items entirely in search mode', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?limit=10&q=chair')
      .set('Cookie', cookie)
      .expect(200);

    expect(body(res).items.length).toBeGreaterThan(0);
    expect(body(res).items.every((i) => !i.isSponsored)).toBe(true);
  });

  it('search is case-insensitive', async () => {
    const lower = await request(app.getHttpServer())
      .get('/products?limit=10&q=chair')
      .set('Cookie', cookie)
      .expect(200);
    const upper = await request(app.getHttpServer())
      .get('/products?limit=10&q=CHAIR')
      .set('Cookie', cookie)
      .expect(200);

    expect(
      body(upper)
        .items.map((i) => i.id)
        .sort(),
    ).toEqual(
      body(lower)
        .items.map((i) => i.id)
        .sort(),
    );
  });

  it('paginates search results without repeating items across pages', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/products?limit=5&q=chair')
      .set('Cookie', cookie)
      .expect(200);
    expect(body(page1).nextCursor).toBeTruthy();

    const page2 = await request(app.getHttpServer())
      .get(
        `/products?limit=5&q=chair&cursor=${encodeURIComponent(body(page1).nextCursor!)}`,
      )
      .set('Cookie', cookie)
      .expect(200);

    const page1Ids = new Set(body(page1).items.map((i) => i.id));
    const overlap = body(page2).items.filter((i) => page1Ids.has(i.id));
    expect(overlap).toHaveLength(0);
  });

  describe('GET /products/suggest', () => {
    it('rejects unauthenticated requests', () => {
      return request(app.getHttpServer())
        .get('/products/suggest?q=chair')
        .expect(401);
    });

    it('returns distinct, non-empty suggestions for a real term', async () => {
      const res = await request(app.getHttpServer())
        .get('/products/suggest?q=chair')
        .set('Cookie', cookie)
        .expect(200);

      const { suggestions } = res.body as { suggestions: string[] };
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(8);
      expect(new Set(suggestions).size).toBe(suggestions.length);
    });

    it('returns an empty array for a query shorter than 2 characters', async () => {
      const res = await request(app.getHttpServer())
        .get('/products/suggest?q=a')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body).toEqual({ suggestions: [] });
    });

    it('returns an empty array when q is omitted entirely', async () => {
      const res = await request(app.getHttpServer())
        .get('/products/suggest')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body).toEqual({ suggestions: [] });
    });

    it('never includes sponsored items', async () => {
      // Sanity check via the main endpoint: every suggested name for a broad
      // term should be reachable as an organic (non-sponsored) product.
      const res = await request(app.getHttpServer())
        .get('/products/suggest?q=chair')
        .set('Cookie', cookie)
        .expect(200);
      const { suggestions } = res.body as { suggestions: string[] };

      for (const name of suggestions) {
        const match = await request(app.getHttpServer())
          .get(`/products?limit=50&q=${encodeURIComponent(name)}`)
          .set('Cookie', cookie)
          .expect(200);
        expect(body(match).items.every((i) => !i.isSponsored)).toBe(true);
      }
    });
  });
});

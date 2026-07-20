import { Injectable } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { Cursor, decodeCursor, encodeCursor } from './cursor';
import { getSponsoredSlotsInRange } from './sponsored-slots';

export interface ProductListItemDto {
  id: number;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  isSponsored: boolean;
}

export interface ProductListResponse {
  items: ProductListItemDto[];
  nextCursor: string | null;
}

const DEFAULT_PAGE_SIZE = 20;

function toDto(
  row: Pick<Product, 'id' | 'name' | 'description' | 'category' | 'priceCents'>,
  isSponsored: boolean,
): ProductListItemDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceCents: row.priceCents,
    isSponsored,
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts(query: GetProductsQueryDto): Promise<ProductListResponse> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const searchTerm = query.q?.trim();

    if (searchTerm) {
      return this.searchProducts(
        searchTerm,
        limit,
        query.category,
        query.cursor,
      );
    }
    return this.browseProducts(limit, query.category, query.cursor);
  }

  private async browseProducts(
    limit: number,
    category: string | undefined,
    cursorRaw: string | undefined,
  ): Promise<ProductListResponse> {
    const cursor = decodeCursor(cursorRaw, 'browse') as Extract<
      Cursor,
      { mode: 'browse' }
    >;

    const rows = await this.prisma.product.findMany({
      where: {
        isSponsored: false,
        id: { gt: cursor.lastId },
        ...(category ? { category } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1, // one extra row to detect whether there's a next page
    });

    const hasMore = rows.length > limit;
    const organic = rows.slice(0, limit);

    const items: ProductListItemDto[] = [];
    if (organic.length > 0) {
      const startPosition = cursor.position + 1;
      const endPosition = cursor.position + organic.length;
      const slots = getSponsoredSlotsInRange(startPosition, endPosition);

      // Sponsored pool respects the active category filter too — an ad for
      // an unrelated category showing up while browsing "Books" would look
      // broken. If a category has no sponsored inventory, its slots simply
      // go unfilled rather than falling back to unrelated products.
      const sponsoredPool =
        slots.length > 0
          ? await this.prisma.product.findMany({
              where: { isSponsored: true, ...(category ? { category } : {}) },
              orderBy: { id: 'asc' },
            })
          : [];

      let organicIndex = 0;
      for (let position = startPosition; position <= endPosition; position++) {
        items.push(toDto(organic[organicIndex], false));
        organicIndex++;

        const slot = slots.find((s) => s.position === position);
        if (slot && sponsoredPool.length > 0) {
          items.push(
            toDto(sponsoredPool[slot.slotIndex % sponsoredPool.length], true),
          );
        }
      }
    }

    const newPosition = cursor.position + organic.length;
    const newLastId =
      organic.length > 0 ? organic[organic.length - 1].id : cursor.lastId;
    const nextCursor = hasMore
      ? encodeCursor({
          mode: 'browse',
          lastId: newLastId,
          position: newPosition,
        })
      : null;

    return { items, nextCursor };
  }

  private async searchProducts(
    searchTerm: string,
    limit: number,
    category: string | undefined,
    cursorRaw: string | undefined,
  ): Promise<ProductListResponse> {
    const cursor = decodeCursor(cursorRaw, 'search') as Extract<
      Cursor,
      { mode: 'search' }
    >;

    const categoryFilter = category
      ? Prisma.sql`AND category = ${category}`
      : Prisma.empty;

    // Trigram similarity ranking (see README "Search"). Sponsored items are
    // always excluded here — spec requires no sponsored items in search mode.
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: number;
        name: string;
        description: string;
        category: string;
        priceCents: number;
      }>
    >`
      SELECT id, name, description, category, "priceCents"
      FROM products
      WHERE "isSponsored" = false
        AND (name % ${searchTerm} OR description % ${searchTerm})
        ${categoryFilter}
      ORDER BY GREATEST(similarity(name, ${searchTerm}), similarity(description, ${searchTerm})) DESC, id DESC
      LIMIT ${limit + 1}
      OFFSET ${cursor.offset}
    `;

    const hasMore = rows.length > limit;
    const organic = rows.slice(0, limit);
    const nextCursor = hasMore
      ? encodeCursor({ mode: 'search', offset: cursor.offset + organic.length })
      : null;

    return { items: organic.map((r) => toDto(r, false)), nextCursor };
  }

  /**
   * Autocomplete suggestions for the search box — distinct organic product
   * names, trigram-ranked, capped at 8. UX pattern (debounce, keyboard nav,
   * empty-state fallback) adapted from an existing BurrowSoft product's
   * search bar — see README "Credits"; this endpoint itself is entirely
   * self-contained against our own data, no external calls.
   */
  async suggest(term: string): Promise<string[]> {
    const trimmed = term.trim();
    if (trimmed.length < 2) return [];

    // word_similarity + <% (not similarity + %) because this is a
    // while-you-type prefix match: a 2-3 char prefix like "cha" has to
    // match "Ergonomic Chair" against just the "Chair" word, and plain
    // trigram similarity() scores that far below its 0.3 default
    // threshold (whole-string length mismatch), returning nothing.
    const rows = await this.prisma.$queryRaw<
      Array<{ name: string; wsim: number }>
    >`
      SELECT DISTINCT name, word_similarity(${trimmed}, name) AS wsim
      FROM products
      WHERE "isSponsored" = false AND ${trimmed} <% name
      ORDER BY wsim DESC
      LIMIT 8
    `;

    return rows.map((r) => r.name);
  }
}

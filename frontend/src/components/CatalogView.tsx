"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ApiError, getProducts, logout, ProductListItem } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { ProductCard } from "./ProductCard";
import { SearchInput } from "./SearchInput";

const PAGE_SIZE = 24;
const ROW_HEIGHT = 96;
const PREFETCH_THRESHOLD = 5;

export function CatalogView() {
  const router = useRouter();

  const [items, setItems] = useState<ProductListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleUnauthenticated = useCallback(() => {
    router.push("/login");
  }, [router]);

  // Reset and load the first page whenever filters change.
  useEffect(() => {
    let cancelled = false;
    setInitialLoad(true);
    setError(null);

    getProducts({ limit: PAGE_SIZE, category: category || undefined, q: query || undefined })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setCursor(res.nextCursor);
        setHasMore(!!res.nextCursor);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return handleUnauthenticated();
        setError("Failed to load products. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setInitialLoad(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, query, handleUnauthenticated]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || initialLoad) return;
    setLoading(true);
    try {
      const res = await getProducts({
        cursor,
        limit: PAGE_SIZE,
        category: category || undefined,
        q: query || undefined,
      });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return handleUnauthenticated();
      setError("Failed to load more products.");
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading, initialLoad, category, query, handleUnauthenticated]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastVisibleIndex = virtualItems.length ? virtualItems[virtualItems.length - 1].index : -1;

  useEffect(() => {
    if (lastVisibleIndex >= items.length - PREFETCH_THRESHOLD) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastVisibleIndex, items.length]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <SearchInput value={searchInput} onChange={setSearchInput} />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-8 text-sm text-zinc-900 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Log out
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mx-auto mt-3 max-w-4xl rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {initialLoad ? (
          <p className="py-10 text-center text-sm text-zinc-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-400">No products found.</p>
        ) : (
          <div
            className="relative mx-auto max-w-4xl px-4"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((virtualRow) => (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 w-full px-4 py-1.5"
                style={{ transform: `translateY(${virtualRow.start}px)`, height: virtualRow.size }}
              >
                <ProductCard product={items[virtualRow.index]} />
              </div>
            ))}
          </div>
        )}

        {loading && <p className="py-4 text-center text-sm text-zinc-400">Loading more…</p>}
        {!hasMore && items.length > 0 && !loading && (
          <p className="py-4 text-center text-sm text-zinc-400">You&apos;ve reached the end.</p>
        )}
      </div>
    </div>
  );
}

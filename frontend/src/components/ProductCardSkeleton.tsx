// Mirrors ProductCard's layout/dimensions exactly, so the swap from
// skeleton -> real card on load doesn't shift the page (no layout jump).
export function ProductCardSkeleton() {
  return (
    <div
      className="flex h-full animate-pulse items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      aria-hidden
    >
      <div className="h-14 w-14 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-800" />

      <div className="min-w-0 flex-1">
        <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-2.5 w-1/4 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <div className="h-4 w-12 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

import { ProductListItem } from "@/lib/api";
import { swatchColor } from "@/lib/swatch-color";

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <div
      className={`flex h-full items-center gap-4 rounded-xl border bg-white p-4 dark:bg-zinc-900 ${
        product.isSponsored
          ? "border-amber-300 dark:border-amber-700"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-lg font-semibold text-white"
        style={{ backgroundColor: swatchColor(product.name) }}
        aria-hidden
      >
        {product.name.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {product.name}
          </h3>
          {product.isSponsored && (
            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Sponsored
            </span>
          )}
        </div>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{product.description}</p>
        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{product.category}</p>
      </div>

      <div className="shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        ${(product.priceCents / 100).toFixed(2)}
      </div>
    </div>
  );
}

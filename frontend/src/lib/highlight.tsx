import { Fragment, type ReactNode } from "react";

// Search is trigram/fuzzy (see backend "Search"), so a query doesn't always
// appear as an exact substring of a result — in that case this just returns
// the text unhighlighted rather than forcing a fuzzy-match visualization.
export function highlightMatches(text: string, query: string): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  // Escape regex metacharacters: query is user-controlled input fed directly
  // into RegExp, and characters like "." or "+" would otherwise be treated
  // as pattern syntax rather than literal text to match.
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark key={i} className="rounded bg-amber-200 text-inherit dark:bg-amber-700/60">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

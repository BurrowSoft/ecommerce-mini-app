// Gates the three "visible" search extras added after the initial
// submission — autocomplete suggestions, match highlighting, and skeleton
// loading placeholders (see README "Extras"). Defaults to true; set
// NEXT_PUBLIC_ENABLE_SEARCH_EXTRAS=false to run with the original,
// pre-extras UI (plain search input, "Loading…" text).
//
// CSRF protection is deliberately NOT covered by this flag: it's a security
// fix, not a UX toggle, and stays enabled regardless of this setting.
export const searchExtrasEnabled = process.env.NEXT_PUBLIC_ENABLE_SEARCH_EXTRAS !== "false";

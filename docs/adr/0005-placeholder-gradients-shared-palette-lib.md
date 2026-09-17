# Placeholder gradients use the shared palette lib, loaded from raw GitHub

Projects whose favicon has no `<linearGradient>` used to fall back to a fixed
grey gradient (`#757575 → #424242`) rendered by a CSS-only fallback class in
the UI. Now the generator itself derives a colorful placeholder gradient and
bakes it into `projects.json`, so the site never renders a grey tile.

Design decisions:

- **Shared function, owner keeps it.** The Palette Random rule (random hue,
  two-shade spread) lives where it is owned: `favicon-creator/docs/lib/palette-lib.js`
  (IIFE, `window.faviconPaletteLib`). The generator does not copy the code —
  it loads the file at run time from one canonical URL:
  `https://raw.githubusercontent.com/danielmroczek/favicon-creator/main/docs/lib/palette-lib.js`
  (`scripts/lib/palette-loader.mjs`). One source of truth; the vendored
  Material Colors data is loaded the same way. No local fallback — the
  generator (like the GitHub API run itself) assumes network access.
- **Determinism via seed.** Placeholder colors must not churn on every
  regeneration, so the draw is seeded with the project's `repo` URL (FNV-1a
  hash inside the lib): same repo → same gradient, stable diffs of
  `projects.json`.
- **Contrast clamp 400–900.** The white letter/icon must stay legible, so the
  generator clamps the draw to shades 400–900 (`shadeRange` option added to
  the lib's `randomPair(palette, { shadeRange, seed })`). The clamp applies to
  both ends of the pair and never degrades the two-step rule. Favicon
  Creator's own UI Palette Random keeps the full 100–900 range — only the
  generator clamps.
- **Fallback class stays.** `.thumb--fallback` remains as a last-resort
  style for entries with no `gradientCSS`, but generated data can no longer
  trigger it.
- **Letter only on placeholders.** Each derived gradient is stamped
  `placeholderGradient: true` in `projects.json`. The UI shows the
  first-letter fallback only on such tiles (when there is no icon too) — a
  gradient extracted from a real favicon renders on its own, even without an
  icon (e.g. Color Matcher's multi-stop gradient).

Rejected alternatives: copy the function into the portfolio (drift risk);
CDN-then-local-checkout fallback chains (two sources, more code); random draws
without seed (churning diffs); clamping inside the lib globally (would change
Favicon Creator's UI behavior the task explicitly left untouched).

# Canonical SVG output is hand-built, not optimized with SVGO

Favicon Creator downloads must satisfy the canonical favicon format
(`danielmroczek.github.io/docs/favicon-format.md`): 32×32 root svg with
`width`/`height`/`viewBox`, one optional `<linearGradient>` referenced by a
full-screen background `<rect>`, and a single marked `<path id="icon">` whose
coordinates carry every transform already baked in.

We hand-build that exact string in `lib/favicon.js` instead of running the
preview DOM through SVGO, because SVGO's `removeViewBox`/`removeDimensions`
plugins strip the very attributes the format requires, and no optimizer can
guarantee the one-marked-path shape. The preview renders the same string the
download writes, so the two can never drift.

Trade-off: no free size optimization. For a ≤1 KB favicon that cost is
negligible; contract compliance and byte-identical preview/download are worth
more. Rejected alternative: keep SVGO and post-process its output — fragile,
two sources of truth, and still can't emit canonical structure.

# Favicons follow a canonical format instead of a generic extractor

The card thumbnails (gradient + white icon) are derived from each project's SVG favicon. A
handful of favicons rendered wrong (missing lines, blank icons, over-filled shapes) because the
extraction logic had to guess the intent of ad-hoc patterns: CSS classes, `var()`, `url(#...)`
references to removed `<defs>`, inherited fill/stroke, and nested `<svg>` wrappers.

We chose a **canonical favicon format** (see `docs/favicon-format.md`) and keep the extractor
deliberately simple instead of teaching it every ad-hoc pattern. Where a favicon doesn't meet the
contract and renders wrong, the favicon is fixed in its own repo — not the script.

Trade-off: this pushes the cost onto the project owners (you) rather than the script, in exchange
for a predictable, low-maintenance extractor. It's the result of a real trade-off (generic
scraper vs. strict contract) and is surprising without context (someone might "helpfully" try to
make the extractor handle all the edge cases again).

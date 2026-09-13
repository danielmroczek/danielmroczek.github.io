# Canonical favicon format

This portfolio extracts each project's card thumbnail (gradient background + white icon) from a
single SVG favicon served at a conventional URL (`href/favicon.svg`, or the repo root's
`favicon.svg`, or an explicit `favicon` override). To keep the extraction **simple and
predictable**, favicons should follow this canonical format. The extractor also accepts a few
allowed variations used by the portfolio's own well-known working favicons (see
[Allowed variations](#allowed-variations)).

The point is: **write favicons against this contract** rather than making the script smarter.
If a favicon renders wrong, fix the favicon — not the script.

## The format

An SVG, 32×32, with this structure:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <!-- OPTIONAL: one linear gradient for the card background -->
  <defs>
    <linearGradient id="gradient" x1="15%" y1="15%" x2="85%" y2="85%">
      <stop stop-color="#33691e"></stop>
      <stop offset="1" stop-color="#558b2f"></stop>
    </linearGradient>
  </defs>

  <!-- OPTIONAL but recommended: full-screen background rect using the gradient -->
  <rect width="32" height="32" rx="4" fill="url(#gradient)"></rect>

  <!-- THE ICON: one or more shapes, each with an explicit white color -->
  <path fill="#fff" d="M8 8h16v16H8z"/>
</svg>
```

### Rules

1. **Root `<svg>` is 32×32** (`width="32" height="32"` and, ideally, `viewBox="0 0 32 32"`).
2. **The gradient is optional.** Without it, the card falls back to a grey thumbnail; the icon
   still renders. If present, use exactly one `<linearGradient>` inside `<defs>`, referenced by
   a full-screen `<rect>`. Stop colors are plain hex values (no `var()`).
3. **Every icon shape has an explicit white color**, either:
   - `fill="#fff"` for filled shapes, **or**
   - `fill="none"` **plus** `stroke="#fff"` (with whatever `stroke-width`,
     `stroke-linecap`, `stroke-linejoin` the shape needs) for outlined shapes.
4. **No `<style>` blocks, no CSS classes, no `var(...)`, no `url(#...)`** on icon shapes.
   These reference things the extractor removes, so they either break or get blanked to white.
5. **No nested `<svg>`** — flatten the icon into plain `<path>`/`<circle>`/`<rect>`/etc. (This is
   a *recommendation*: the extractor still tolerates nesting, but it's the most common source of
   rendering surprises and should be avoided.)

## Allowed variations

The extractor still renders these today, and the portfolio's existing working favicons use them.
You don't have to rewrite a favicon that already renders correctly; these are listed so new
favicons don't accidentally rely on them:

- **Inherited `fill`/`stroke`** from a wrapping `<svg>`/`<g>` (e.g. `fill="none" stroke="#fff"`
  on the group, with plain shapes inside). This is how the lucide-style icons work.
- **Nested `<svg>`** with `x`/`y`/`width`/`height`/`viewBox` (the extractor flattens it).

These are accepted so existing working favicons are left untouched, but they're fragile — prefer
the canonical rules above for anything new.

## What the extractor does

Given a favicon it:

1. Reads the optional `<linearGradient>` and turns it into `gradientCSS`.
2. Removes `<defs>`, `<style>`, the background `<rect>`, and the outer `<svg>` wrapper.
3. Normalizes each remaining shape's fill/stroke to white.
4. Emits the remainder as `iconSvg`.

If the favicon has **no gradient**, the icon is still extracted (the card just gets a grey
thumbnail). If extraction yields something it can't render safely (e.g. a shape whose fill
references a removed `<defs>`), the icon is dropped and the card shows the letter fallback.

## Checking a favicon

Use the checker to see whether a favicon meets the contract and what to fix:

```
node scripts/check-favicon.mjs path/to/favicon.svg
```

It lists violations and suggests concrete fixes. Run it on every favicon before changing it.

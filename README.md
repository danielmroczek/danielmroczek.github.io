# Daniel Mroczek's Personal Website

This repository contains the source code for my personal portfolio website, hosted on GitHub Pages.

## Address

Website is available here: [Daniel Mroczek's Portfolio](https://danielmroczek.github.io)

## Overview

This website serves as my personal portfolio, showcasing my work and projects.

The single-page site is built with [Pico.css 2](https://picocss.com) (loaded from CDN) and
[Alpine.js 3](https://alpinejs.dev) on a minimalist, class-light semantic HTML structure. The color
scheme follows the user's system preference automatically (light/dark via `prefers-color-scheme`), and
the accent color is customized through `--pico-primary-*` variables. All extra styles are layout-only
(grid, spacing, card hover); no component styles are overridden.

Projects are rendered into the grid by Alpine from [`projects.json`](projects.json) (title,
description, href, repo, tags, gradientCSS, iconSvg). `projects.json` is **generated**, not
hand-edited — see [Regenerating projects.json](#regenerating-projectsjson) below. Each project
card displays a gradient thumbnail extracted from the project's SVG favicon — the gradient
background and icon are baked into `projects.json` at build time by the generator.
Projects without a favicon or deployed demo fall back to a grey gradient with the first letter
of the title. Cards without a deployed demo show only the Repo link (no Demo).
The Alpine version is pinned via an
[import map](/index.html) in the HTML, and all application JS lives in [`script.js`](script.js), which
imports Alpine, fetches `projects.json`, and exposes a reactive project list with tag filtering.
A tag filter bar shows only tags shared by at least 2 projects; clicking a tag filters the grid,
and "All" resets it.
The [x-cloak](https://alpinejs.dev/directives/cloak) directive hides content until Alpine loads.

### Regenerating projects.json

`projects.json` is generated from [`config.json`](config.json) against the live GitHub account
by `scripts/generate.mjs`:

```
node scripts/generate.mjs
```

The generator:

1. Fetches all non-fork, non-archived repositories for the configured owner.
2. Excludes repos listed under `ignoredProjects`, plus the owner's own `<owner>.github.io`
   site and the special profile repo (named after the owner).
3. Resolves each repo's Pages URL (`https://<owner>.github.io/<name>`) as its demo `href`;
   repos without Pages become repository-only cards (no demo link).
4. Builds each project's tags from the repo's GitHub topics plus any curated `overrides`.
5. Downloads each project's `favicon.svg` and extracts the gradient + icon into `projects.json`.
6. Defaults to sorting by `pushed_at` (most recent first).

Run with `--no-favicons` to skip the favicon download step and instead reuse whatever SVG
favicons already exist in `tmp/` (useful for a quick local experiment without re-hitting GitHub):

```
node scripts/generate.mjs --no-favicons
```

The GitHub token is read from `.env` (`GITHUB_TOKEN=...`) but is optional — the script also
works against the public API without it. `.env` is gitignored.

#### config.json

```jsonc
{
  "owner": "danielmroczek",            // GitHub account to pull projects from
  "ignoredProjects": [],               // exact repo names to exclude
  "include": {},                       // (reserved) opt back into default exclusions
  "sort": "pushed",                    // "pushed" | "created" | "full_name" | "size"
  "overrides": {
    "drum-pad": {                      // key = repo name
      "title": "Drumpad",              // optional curated display title
      "description": "...",            // optional curated description
      "tags": ["music", "audio"],      // optional curated tags (merged with GitHub topics)
      "href": "https://...",           // optional explicit demo URL
      "favicon": "https://.../x.svg",  // optional explicit favicon URL
      "iconSvg": "<path .../>",        // optional override icon (wins over extracted one)
      "gradientCSS": "linear-gradient(...)" // optional override gradient
    }
  }
}
```

`overrides` is the only place for hand curation (nice titles, descriptions, tags GitHub can't
infer, custom demo/favicon locations). Everything else is pulled live.

### Favicon script

`scripts/favicons.mjs` is the thin CLI around the shared favicon logic used by the generator.
It reads `projects.json`, downloads SVG favicons, and extracts gradient + icon data back into
`projects.json`. It supports two flags:

- `--download-only` — download favicons to `tmp/` without extracting data
- `--extract-only` — extract data from existing SVGs in `tmp/` without downloading

Without flags, it does both (download then extract). Prefer `scripts/generate.mjs` for normal
use — it regenerates the whole file including favicons.

## Favicon format & checker

Card thumbnails (gradient + white icon) are extracted from each project's SVG favicon. To keep
extraction simple and predictable, favicons should follow the **canonical favicon format**
described in [`docs/favicon-format.md`](docs/favicon-format.md). If a favicon renders wrong,
the fix belongs in the favicon (in its own repo) — not in the script.

Before changing a favicon, check it against the format:

```
node scripts/check-favicon.mjs path/to/favicon.svg
```

It lists hard violations to fix and softer recommendations. `tests/check.mjs` also warns about
favicons that break rendering, so you'll be reminded when a project's favicon drifts from the
format.

## Setup

To run this website locally (development):

1. Clone the repository
2. Navigate to the project directory
3. Serve the directory over HTTP (required, since `fetch("projects.json")` is blocked on `file://`
   pages), for example: `python -m http.server`
4. Open `http://localhost:8000` in your browser

> Note: GitHub Pages serves the site over HTTPS, so no server is needed in production.

## Checks

A zero-dependency sanity check validates the structure of `projects.json` and the tag-filter
logic. Run it with Node:

```
node tests/check.mjs
```

## Contact

- GitHub: [@danielmroczek](https://github.com/danielmroczek)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

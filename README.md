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

Projects are defined declaratively in [`projects.json`](projects.json) (title, description, href,
tags, gradientCSS, iconSvg) and rendered into the grid by Alpine. Each project card displays a
gradient thumbnail extracted from the project's SVG favicon — the gradient background and icon
are baked into `projects.json` at build time by [`scripts/favicons.mjs`](scripts/favicons.mjs).
Projects without a favicon fall back to a grey gradient with the first letter of the title.
The Alpine version is pinned via an
[import map](/index.html) in the HTML, and all application JS lives in [`script.js`](script.js), which
imports Alpine, fetches `projects.json`, and exposes a reactive project list with tag filtering.
A tag filter bar shows only tags shared by at least 2 projects; clicking a tag filters the grid,
and "All" resets it.
The [x-cloak](https://alpinejs.dev/directives/cloak) directive hides content until Alpine loads.

### Favicon script

`scripts/favicons.mjs` downloads SVG favicons from each project's deployed URL and extracts
gradient + icon data into `projects.json`. It supports two flags:

- `--download-only` — download favicons to `tmp/` without extracting data
- `--extract-only` — extract data from existing SVGs in `tmp/` without downloading

Without flags, it does both (download then extract).

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

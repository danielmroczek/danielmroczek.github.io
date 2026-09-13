# Portfolio

The personal portfolio site. A single static GitHub Pages page whose project grid is
data-driven from a generated `projects.json`.

## Language

**Project**:
A showcased repository of the account owner, rendered as a card on the site. A project may or
may not have a deployed demo URL (`href`).
_Avoid_: Repo (only used for the raw GitHub source), card, tile

**Config**:
The `config.json` file that drives regeneration — the account owner, ignored projects,
overridden fields, and default sort.
_Avoid_: Settings, options

**Source project**:
A repository fetched from the GitHub account, before curation. Source projects are filtered,
sorted, and possibly overridden to become Projects.
_Avoid_: Raw repo, upstream project

**Curated project**:
A Project after the agent applies `overrides`. The distinction matters because a Project is both
a GitHub repo and a hand-tuned portfolio entry.
_Avoid_: Overridden project, final project

**Override**:
A per-source-project map in `config.json` that rewrites the curated project's fields (title,
description, tags, href, favicon location).
_Avoid_: Patch, edit

**Ignored project**:
A source project excluded from the output by exact repository name in `config.json`.
_Avoid_: Skip, blacklist, excluded

**Deployed project**:
A Project that has a live Pages site, giving it an `href` and a demo link.
_Avoid_: Hosted project, published project

**Repository-only project**:
A Project with no deployed site — shown as a card with a Repo link but no Demo link.
_Avoid_: Bare project, no-demo project

**Favicon data**:
The `gradientCSS` and `iconSvg` pair extracted from a project's SVG favicon and baked into
`projects.json`.
_Avoid_: Icon data, thumbnail

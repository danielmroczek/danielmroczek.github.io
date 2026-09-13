# Projects.json is generated from config.json + GitHub, not hand-edited

`projects.json` (the data source of the project grid) is now produced by
`scripts/generate.mjs` from `config.json` plus the live GitHub account, instead of being
hand-maintained. Curated fields that GitHub cannot recover (tags, titles, descriptions, href,
favicon location) live in `config.json` under `overrides`.

This is hard to reverse in the sense that the site's data now has a single generator and a
config source of truth; editing `projects.json` by hand will be overwritten. It is surprising
without context (a reader must know the JSON is a build artifact), and it is the result of a
real trade-off (hand-curation vs. automation chosen for freshness and one-command upkeep).

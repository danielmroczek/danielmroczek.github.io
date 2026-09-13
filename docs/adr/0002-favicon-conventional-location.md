# Favicon data is derived from a conventional location, not scraped

Favicon data (`gradientCSS`, `iconSvg`) is read from one conventional URL per project —
`href/favicon.svg`, or the repository root's `favicon.svg` when there is no `href` — with an
explicit `favicon` override per project in `config.json` when the file is elsewhere. A missing
favicon falls back to a grey placeholder thumbnail in the UI.

This is surprising (real sites often serve `favicon.ico` or a link-tag touch icon, and other
builds scrape `<link rel="icon">`), and it is a deliberate KISS trade-off: keep the extractor
dumb and predictable instead of negotiating arbitrary search strategies.

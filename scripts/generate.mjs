import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rootDir, downloadFavicons, extractFaviconDataFromFiles } from "./lib/favicon.mjs";
import { loadEnvFile } from "./lib/loadEnv.mjs";
import { importWindowGlobalFromUrl } from "./lib/remote-iife.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "..", "config.json");
const projectsPath = path.join(rootDir, "projects.json");

const API = "https://api.github.com";
const { GITHUB_TOKEN } = loadEnvFile(path.join(rootDir, ".env"));

// Shared palette lib + data, served by the favicon-creator repo
// (raw.githubusercontent.com like a CDN). The files are IIFEs that assign
// onto a global `window` — importWindowGlobalFromUrl fetches and evaluates
// them, then returns the requested export.
const PALETTE_LIB_URL =
  "https://raw.githubusercontent.com/danielmroczek/favicon-creator/main/docs/lib/palette-lib.js";
const MATERIAL_COLORS_URL =
  "https://raw.githubusercontent.com/danielmroczek/favicon-creator/main/docs/lib/material-colors.js";

async function githubRequest(url, { acceptTopics = false } = {}) {
  const headers = {
    "User-Agent": "portfolio-generator",
    "Accept": acceptTopics
      ? "application/vnd.github.mercy-preview+json"
      : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status} for ${url}: ${detail}`);
  }
  return res.json();
}

/** Fetch all repos for the owner, following pagination. Excludes forks. */
async function fetchAllRepos(owner) {
  const repos = [];
  let url = `${API}/users/${owner}/repos?per_page=100&type=owner&sort=pushed`;
  while (url) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "portfolio-generator",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`GitHub ${res.status} for ${url}: ${detail}`);
    }
    const page = await res.json();
    repos.push(...page);

    const link = res.headers.get("link") || "";
    const next = (link.match(/<([^>]+)>;\s*rel="next"/) || [])[1];
    url = next || null;
  }
  return repos;
}

/** Resolve the deployed Pages URL for a repo, or null if it has no Pages site. */
async function fetchPagesUrl(owner, repoName) {
  const pages = await githubRequest(`${API}/repos/${owner}/${repoName}/pages`);
  return pages?.html_url ?? null;
}

/** Fetch topics for a repo (empty array when none). */
async function fetchTopics(owner, repoName) {
  const topics = await githubRequest(
    `${API}/repos/${owner}/${repoName}/topics`,
    { acceptTopics: true }
  );
  return topics?.names ?? [];
}

/**
 * Generate a presentable title from a raw repository name.
 * "lego-set-finder-cli" -> "Lego Set Finder".
 */
function friendlyTitle(repoName) {
  return String(repoName)
    .replace(/-(cli|lib)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Strip a leading emoji from a description (after trimming) and trim again.
 * "🚍 Interaktywna ..." -> "Interaktywna ...".
 */
function cleanDescription(description) {
  let value = String(description ?? "").trim();
  // Remove the leading emoji (after trim) and trim again. Handles single
  // pictographs, regional-indicator flags, skin-tone/ZWJ sequences, and a
  // trailing variation selector.
  const emojiRegex =
    /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:\u{FE0F}\u{200D}\p{Extended_Pictographic}|\p{Emoji_Modifier})*\u{FE0F}?/u;
  value = value.replace(emojiRegex, "").trim();
  return value;
}

export async function generate({ config, skipFaviconDownload = false } = {}) {
  if (!config) {
    config = JSON.parse(await fs.readFile(configPath, "utf8"));
  }

  const owner = config.owner;
  const ignored = new Set(config.ignoredProjects ?? []);
  const overrides = config.overrides ?? {};
  const include = config.include ?? {};
  const sort = config.sort ?? "pushed";

  // Shared palette lib (favicon-creator) draws placeholder gradients for
  // projects whose favicon has none. Must be loaded even when the favicon
  // download is skipped — placeholders apply after extraction either way.
  const paletteLib = await importWindowGlobalFromUrl(PALETTE_LIB_URL, "faviconPaletteLib");
  const materialPalette = await importWindowGlobalFromUrl(MATERIAL_COLORS_URL, "materialColors");

  // The portfolio's own hosted repo and the special profile repo (named after
  // the owner) are always excluded unless explicitly included.
  const defaultExcludes = new Set([`${owner}.github.io`, owner]);

  console.log(`Fetching repos for ${owner}...`);
  const repos = await fetchAllRepos(owner);

  const sourceProjects = repos.filter((repo) => {
    if (repo.archived) return false; // archived repositories are excluded
    if (ignored.has(repo.name)) return false;
    if (defaultExcludes.has(repo.name) && !(repo.name in include)) return false;
    return true;
  });

  console.log(`Found ${sourceProjects.length} source projects after filtering.`);

  const projects = [];
  for (const repo of sourceProjects) {
    const ov = overrides[repo.name] ?? {};
    const overrideHref = typeof ov.href === "string" ? ov.href.trim() : "";
    const href = overrideHref || (await fetchPagesUrl(owner, repo.name));
    const topics = await fetchTopics(owner, repo.name);

    const tags = Array.from(new Set([...(ov.tags ?? []), ...topics]));

    const project = {
      title: ov.title ?? friendlyTitle(repo.name),
      description: ov.description ?? cleanDescription(repo.description),
      ...(href ? { href } : {}),
      repo: repo.html_url,
      tags,
    };

    // Carried only for favicon resolution / extraction, stripped before output.
    if (ov.favicon) project.favicon = ov.favicon;

    projects.push(project);
    console.log(`  ${repo.name}${href ? " [deployed]" : " [repo-only]"}`);
  }

  // Default sort: pushed_at descending (most recently pushed first).
  const keyBy = {
    pushed: (p) => repos.find((r) => r.html_url === p.repo)?.pushed_at ?? "",
    created: (p) => repos.find((r) => r.html_url === p.repo)?.created_at ?? "",
    full_name: (p) => p.title.toLowerCase(),
    size: (p) => repos.find((r) => r.html_url === p.repo)?.size ?? 0,
  };
  const getKey = keyBy[sort] ?? keyBy.pushed;
  const desc = sort === "full_name" ? false : true;

  projects.sort((a, b) => {
    const ka = getKey(a);
    const kb = getKey(b);
    if (ka > kb) return desc ? -1 : 1;
    if (ka < kb) return desc ? 1 : -1;
    return 0;
  });

  // Favicon data: download then extract, then write once. With --no-favicons,
  // skip the download and reuse whatever SVGs already exist in tmp/.
  if (!skipFaviconDownload) {
    console.log("\nDownloading favicons...");
    await downloadFavicons(projects, { owner });
  } else {
    console.log("\nSkipping favicon download (reusing SVGs in tmp/).");
  }
  console.log("\nExtracting favicon data...");
  await extractFaviconDataFromFiles(projects);

  // Placeholder gradients (CONTEXT.md "Placeholder Gradient"): any project
  // left without a gradient after extraction gets a color pair drawn by the
  // shared palette lib instead of the old grey fallback. The pair is seeded
  // from the repo URL (deterministic across runs) and clamped to shades
  // 400–900 so the white letter/icon always contrasts against the light
  // ends of the Material scale. Curated overrides below still win.
  console.log("\nApplying placeholder gradients...");
  for (const p of projects) {
    if (p.gradientCSS) continue;
    const seed = String(p.repo ?? p.title ?? "");
    const pair = paletteLib.randomPair(materialPalette, { seed, shadeRange: [400, 900] });
    p.gradientCSS = `linear-gradient(to bottom right, ${pair.startHex} 0%, ${pair.endHex} 100%)`;
    // Marks a derived (not favicon-extracted) gradient so the UI shows the
    // letter fallback on this tile; real favicon gradients render alone.
    p.placeholderGradient = true;
    console.log(`  PLACEHOLDER ${p.title}: ${pair.startKey} → ${pair.endKey}`);
  }

  // Curated icon/gradient overrides win over anything extracted from the favicon.
  // Keyed by repository name (derived from the project's repo URL).
  for (const p of projects) {
    const repoName = String(p.repo ?? "").replace(/\/+$/, "").split("/").pop();
    const ov = overrides[repoName] ?? {};
    if (typeof ov.iconSvg === "string") {
      p.iconSvg = ov.iconSvg;
      console.log(`  OVERRIDE ICON ${repoName}`);
    }
    if (typeof ov.gradientCSS === "string") {
      p.gradientCSS = ov.gradientCSS;
      console.log(`  OVERRIDE GRADIENT ${repoName}`);
    }
  }

  // Strip config-only fields from the output.
  for (const p of projects) {
    delete p.favicon;
    delete p.image;
    delete p.imageAlt;
  }

  await fs.writeFile(projectsPath, JSON.stringify(projects, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${projectsPath} (${projects.length} projects)`);
  return projects;
}

// Run directly: `node scripts/generate.mjs [--no-favicons]`
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const skipFaviconDownload = process.argv.includes("--no-favicons");
  generate({ skipFaviconDownload }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

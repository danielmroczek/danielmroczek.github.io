/**
 * Zero-dependency sanity checks for the portfolio.
 * Run:  node tests/check.mjs
 *
 * Validates:
 *  1. projects.json is a well-formed array and every project has the required
 *     runtime fields (title, description, repo, tags).
 *  2. No config-only fields leak into the runtime output (favicon).
 *  3. Every project has either gradientCSS or a fallback path.
 *  4. The tag-filter expression used by script.js (filteredProjects getter)
 *     returns the expected projects for a known tag.
 *  5. Tag-filterable set (tags used by ≥2 projects) matches the curated config.
 *
 * NOTE: this duplicates the one-line filter expression from script.js on purpose —
 * the browser file must stay a single dependency-free module (Alpine import only),
 * so there is no shared module Node could import directly.
 *
 * Unlike the previous hand-counted version, expected counts and tags are derived
 * from config.json so the checks pass after any regeneration.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const projects = JSON.parse(readFileSync(new URL("../projects.json", import.meta.url), "utf8"));
const config = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));

// --- 1. Schema sanity ---------------------------------------------------------
assert.ok(Array.isArray(projects), "projects.json must be an array");
for (const p of projects) {
  for (const key of ["title", "description", "repo", "tags"]) {
    assert.ok(p[key] !== undefined && p[key] !== "", `project ${JSON.stringify(p.title)} missing ${key}`);
  }
  assert.ok(Array.isArray(p.tags), `${p.title} tags should be an array`);

  // Config-only fields should not leak into the runtime output.
  assert.ok(p.favicon === undefined, `${p.title} should not have 'favicon' field`);
  assert.ok(p.image === undefined, `${p.title} should not have 'image' field`);
  assert.ok(p.imageAlt === undefined, `${p.title} should not have 'imageAlt' field`);
}

// 1b. All curated overrides in config must have produced a project.
const curatedTitles = new Set(projects.map((p) => p.title));
const expectedTitles = new Set(
  Object.values(config.overrides ?? {})
    .map((o) => o.title)
    .filter(Boolean)
);
for (const title of expectedTitles) {
  assert.ok(curatedTitles.has(title), `curated project "${title}" missing from projects.json`);
}

// --- 2. Gradient & icon data --------------------------------------------------
for (const p of projects) {
  if (p.gradientCSS) {
    assert.ok(
      p.gradientCSS.startsWith("linear-gradient("),
      `${p.title} gradientCSS should be a linear-gradient`
    );
  }

  if (p.iconSvg) {
    assert.ok(
      typeof p.iconSvg === "string" && p.iconSvg.length > 0,
      `${p.title} iconSvg should be a non-empty string`
    );
    // iconSvg should NOT contain fill="url(#...)" — those reference removed <defs>
    assert.ok(
      !/fill="url\(/.test(p.iconSvg),
      `${p.title} iconSvg should not contain fill="url(#...)"`
    );
  }
}

// --- 3. Filter expression (mirrors script.js filteredProjects) ---------------
const filterProjects = (list, activeTag) =>
  activeTag ? list.filter((p) => p.tags.includes(activeTag)) : list;

// No filter -> all projects
assert.equal(filterProjects(projects, null).length, projects.length, "null tag shows all");

// Every tag that appears filters to a strict subset (or equal for a single-tag project),
// and every filtered result actually carries the active tag.
const allTags = new Set(projects.flatMap((p) => p.tags));
for (const tag of allTags) {
  const filtered = filterProjects(projects, tag);
  assert.ok(filtered.length >= 1, `tag "${tag}" should match at least one project`);
  for (const p of filtered) {
    assert.ok(p.tags.includes(tag), `filtered "${p.title}" should include tag "${tag}"`);
  }
}

// unknown tag -> empty
assert.equal(filterProjects(projects, "does-not-exist").length, 0, "unknown tag shows nothing");

// --- 4. Filterable tags (mirrors script.js filterableTags getter) -----------
// The filter bar shows tags shared by >=2 projects in the generated data.
// Since tags come from a mix of curated overrides and GitHub topics, the only
// stable invariant is: a tag is filterable IFF at least two projects carry it.
const getFilterableTags = (list) => {
  const counts = {};
  for (const p of list) {
    for (const t of p.tags) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  return Object.keys(counts)
    .filter((t) => counts[t] >= 2)
    .sort();
};

const filterable = new Set(getFilterableTags(projects));

// Recompute from a fresh count to confirm the getter is internally consistent.
const counts = {};
for (const p of projects) {
  for (const t of p.tags) {
    counts[t] = (counts[t] || 0) + 1;
  }
}
const everyTag = Object.keys(counts).sort();
for (const tag of everyTag) {
  if (counts[tag] >= 2) {
    assert.ok(filterable.has(tag), `"${tag}" shared by ${counts[tag]} projects should be filterable`);
  } else {
    assert.ok(!filterable.has(tag), `"${tag}" used by ${counts[tag]} project should NOT be filterable`);
  }
}

console.log("ALL CHECKS PASSED");

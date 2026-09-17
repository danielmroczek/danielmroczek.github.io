/**
 * Zero-dependency sanity checks for the portfolio.
 * Run:  node tests/check.mjs
 *
 * Validates:
 *  1. projects.json is well-formed and every project has non-empty required fields.
 *  2. Every project has either gradientCSS or falls back correctly.
 *  3. The tag-filter expression used by script.js (filteredProjects getter)
 *     returns the expected projects for a known tag.
 *
 * NOTE: this duplicates the one-line filter expression from script.js on purpose —
 * the browser file must stay a single dependency-free module (Alpine import only),
 * so there is no shared module Node could import directly.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const projects = JSON.parse(readFileSync(new URL("../projects.json", import.meta.url), "utf8"));

// --- 1. Schema sanity ---------------------------------------------------------
assert.ok(Array.isArray(projects), "projects.json must be an array");
assert.equal(projects.length, 6, "expected 6 projects");
for (const p of projects) {
  for (const key of ["title", "description", "href", "tags"]) {
    assert.ok(p[key] !== undefined && p[key] !== "", `project ${JSON.stringify(p.title)} missing ${key}`);
  }
  assert.ok(Array.isArray(p.tags) && p.tags.length > 0, `${p.title} needs at least one tag`);

  // Old image/imageAlt fields should not exist
  assert.ok(p.image === undefined, `${p.title} should not have 'image' field`);
  assert.ok(p.imageAlt === undefined, `${p.title} should not have 'imageAlt' field`);
}

// --- 2. Gradient & icon data --------------------------------------------------
for (const p of projects) {
  // The generator now derives a placeholder gradient for any project whose
  // favicon has none, so every generated project.json entry has one.
  assert.ok(
    typeof p.gradientCSS === "string" && p.gradientCSS.length > 0,
    `${p.title} should have a gradientCSS (extracted or placeholder)`
  );
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
assert.equal(filterProjects(projects, null).length, 6, "null tag shows all");

// 'gps' tag -> GPS Viewer + Nearest Mount Point Finder
const gps = filterProjects(projects, "gps").map((p) => p.title);
assert.deepEqual(gps, ["GPS Viewer", "Nearest Mount Point Finder"], "gps filter mismatch");

// 'music' tag -> only Drumpad
const music = filterProjects(projects, "music").map((p) => p.title);
assert.deepEqual(music, ["Drumpad"], "music filter mismatch");

// unknown tag -> empty
assert.equal(filterProjects(projects, "does-not-exist").length, 0, "unknown tag shows nothing");

// --- 4. Filterable tags (mirrors script.js filterableTags getter) -----------
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

const filterable = getFilterableTags(projects);
assert.deepEqual(filterable, ["gps", "test", "tool"], "filterable tags should be gps, test and tool only");

console.log("ALL CHECKS PASSED");

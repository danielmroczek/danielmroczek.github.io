/**
 * Zero-dependency sanity checks for the Alpine.js refactor.
 * Run:  node tests/check.mjs
 *
 * Validates:
 *  1. projects.json is well-formed and every project has non-empty required fields.
 *  2. The tag-filter expression used by script.js (filteredProjects getter)
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
  for (const key of ["title", "description", "href", "image", "imageAlt", "tags"]) {
    assert.ok(p[key] !== undefined && p[key] !== "", `project ${JSON.stringify(p.title)} missing ${key}`);
  }
  assert.ok(Array.isArray(p.tags) && p.tags.length > 0, `${p.title} needs at least one tag`);
}

// --- 2. Filter expression (mirrors script.js filteredProjects) ---------------
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

console.log("ALL CHECKS PASSED");

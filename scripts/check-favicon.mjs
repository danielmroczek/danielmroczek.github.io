import fs from "node:fs/promises";
import path from "node:path";

/**
 * Validate a favicon SVG against the canonical format in docs/favicon-format.md.
 * Usage: node scripts/check-favicon.mjs path/to/favicon.svg [more.svg ...]
 *
 * Prints each violation with a concrete suggested fix. Exits 1 if any file
 * has a hard violation (renders wrong), 0 otherwise.
 */
const HARD = "HARD"; // renders wrong — must fix
const SOFT = "SOFT"; // fragile / recommended to fix

function checkSvg(contents) {
  const issues = [];

  // --- Hard: things that break rendering after extraction ---
  if (/<style[\s\S]*?<\/style>|<style\s*\/>/i.test(contents)) {
    issues.push({
      severity: HARD,
      what: "contains a <style> block",
      fix: "Remove the <style> block and put explicit fill/stroke attributes directly on each shape.",
    });
  }
  if (/class="/i.test(contents)) {
    issues.push({
      severity: HARD,
      what: "uses CSS classes (class=\"...\")",
      fix: "Replace each class with an explicit fill/stroke attribute on the shape (classes are stripped and break fills).",
    });
  }
  if (/var\(/i.test(contents)) {
    issues.push({
      severity: HARD,
      what: "uses CSS var(...) references",
      fix: "Replace var() with literal color values (e.g. #fff).",
    });
  }
  // No style="..." attributes at all: presentation must live in attributes on
  // the shapes (fill, stroke, stroke-width, stroke-linecap, ...). The extractor
  // does not inline CSS, so style-based values are lost or blanked to white.
  const styleAttrs = contents.match(/\sstyle="[^"]*"/gi) || [];
  if (styleAttrs.length > 0) {
    issues.push({
      severity: HARD,
      what: `${styleAttrs.length} style="..." attribute(s) (CSS declarations instead of presentation attributes)`,
      fix: 'Move every declaration into presentation attributes on the same element, e.g. style="fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round" becomes fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round".',
    });
  }
  // No transform attributes: the icon must be plain shapes whose coordinates
  // already fit the 32x32 canvas. Transforms add a layer of indirection the
  // extractor has to keep around (a wrapping <g>), which is not the contract.
  const transforms = contents.match(/\stransform="[^"]*"/gi) || [];
  if (transforms.length > 0) {
    issues.push({
      severity: HARD,
      what: `${transforms.length} transform="..." attribute(s)`,
      fix: "Remove the transform and bake its translation/scale directly into the shape coordinates (draw the icon on the 32x32 canvas), e.g. path data shifted/scaled so no transform is needed.",
    });
  }
  // url(#...) on an ICON SHAPE (non-background) breaks icons. The full-screen
  // background <rect> legitimately references url(#gradient) — that's canonical,
  // so exclude full-size rects from this rule.
  const isNotFullScreenRect = (tag) =>
    !/^<rect/.test(tag) || !/\bwidth="32"|\bheight="32"/.test(tag);
  const urlRefs = (contents.match(/<(path|circle|rect|ellipse|line|polygon|polyline|g)[^>]*(?:fill|stroke)\s*=\s*"url\([^)]+\)"[^>]*>/gi) || [])
    .filter(isNotFullScreenRect);
  if (urlRefs.length > 0) {
    issues.push({
      severity: HARD,
      what: `${urlRefs.length} icon shape(s) reference url(#...) in fill/stroke`,
      fix: "Replace with a literal white fill or stroke (#fff). A fill referencing the background gradient makes the icon invisible.",
    });
  }
  // A shape with fill="none" and no stroke is invisible.
  const shapeFillNoneNoStroke = (contents.match(
    /<(path|circle|rect|ellipse|line|polygon|polyline)[^>]*\bfill="none"[^>]*>/gi
  ) || []).filter((t) => !/\bstroke="/i.test(t));
  if (shapeFillNoneNoStroke.length > 0) {
    issues.push({
      severity: HARD,
      what: `${shapeFillNoneNoStroke.length} shape(s) have fill="none" with no stroke (invisible)`,
      fix: "Add stroke=\"#fff\" to these shapes, or change fill=\"none\" to fill=\"#fff\".",
    });
  }

  // --- SOFT: fragile patterns the extractor tolerates but prefers avoided ---
  const nestedSvg = (contents.match(/<svg[\s>]/gi) || []).length - 1;
  if (nestedSvg > 0) {
    issues.push({
      severity: SOFT,
      what: `${nestedSvg} nested <svg> element(s)`,
      fix: "Flatten nested <svg> into plain shapes with explicit coordinates/styles.",
    });
  }
  if (/stroke="#f5f5f5"|#f5f5f5/i.test(contents)) {
    issues.push({
      severity: SOFT,
      what: "uses a near-white stroke (#f5f5f5) instead of pure white",
      fix: "Use stroke=\"#fff\" (the extractor normalizes these anyway, but #fff is clearest).",
    });
  }
  if (/currentColor/i.test(contents)) {
    issues.push({
      severity: HARD,
      what: "uses stroke=\"currentColor\"",
      fix: "Replace currentColor with #fff (currentColor resolves to the surrounding text color, not white).",
    });
  }
  // A <g> or <svg> wrapper that sets fill:none (in style or attr), with shapes
  // inside that carry no explicit stroke: the extractor won't propagate
  // style-based fill:none, so the inner shapes get blanked to white.
  const noneFilledWrappers = contents.match(
    /<g\b[^>]*(?:style="[^"]*fill:none|fill="none")[^>]*>[\s\S]{0,400}(?:<path|<circle|<rect|<ellipse|<line)/i
  );
  if (noneFilledWrappers) {
    issues.push({
      severity: HARD,
      what: "a <g> wrapper sets fill:none and contains shapes without explicit stroke",
      fix: "Put fill=\"none\" stroke=\"#fff\" (and any stroke props) directly on each inner shape instead of relying on the wrapper.",
    });
  }
  // Root svg should be 32x32
  const rootMatch = contents.match(/<svg\b([^>]*)>/i);
  const rootAttrs = rootMatch ? rootMatch[1] : "";
  const w = (rootAttrs.match(/\bwidth="([^"]+)"/i) || [])[1];
  const h = (rootAttrs.match(/\bheight="([^"]+)"/i) || [])[1];
  if (w && h && (w !== "32" || h !== "32")) {
    issues.push({
      severity: SOFT,
      what: `root <svg> is ${w}x${h}, not 32x32`,
      fix: "Set width=\"32\" height=\"32\" (and viewBox=\"0 0 32 32\").",
    });
  }

  return issues;
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/check-favicon.mjs path/to/favicon.svg [more.svg ...]");
    process.exitCode = 2;
    return;
  }

  let hard = 0;
  for (const file of files) {
    const contents = await fs.readFile(path.resolve(file), "utf8");
    const issues = checkSvg(contents);
    const label = path.basename(file);

    console.log(`\n=== ${label} ===`);
    if (issues.length === 0) {
      console.log("  OK — meets the favicon contract.");
      continue;
    }

    for (const issue of issues) {
      const tag = issue.severity === HARD ? "FIX" : "RECOMMEND";
      console.log(`  [${tag}] ${issue.what}`);
      console.log(`         ${issue.fix}`);
      if (issue.severity === HARD) hard += 1;
    }
  }

  console.log(`\n${hard > 0 ? `✗ ${hard} hard violation(s) — fix these favicons.` : "No hard violations."}`);
  process.exitCode = hard > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

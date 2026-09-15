import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootDir = path.resolve(__dirname, "..", "..");

export const defaultTmpDir = path.join(rootDir, "tmp");

const slugify = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "favicon";

/**
 * Resolve the conventional favicon URL for a project.
 * Order of preference:
 *   1. An explicit `favicon` field (from an override).
 *   2. `${href}/favicon.svg` when the project is deployed.
 *   3. The repository root's `favicon.svg` via raw GitHub for repo-only projects.
 */
export function resolveFaviconUrl(project, owner) {
  const explicit = String(project.favicon ?? "").trim();
  if (explicit) return explicit;

  const href = String(project.href ?? "").trim();
  if (href) {
    return new URL("favicon.svg", href.endsWith("/") ? href : `${href}/`).toString();
  }

  const repoUrl = String(project.repo ?? "").trim();
  const repoName = repoUrl
    .replace(/\/+$/, "")
    .split("/")
    .pop();
  return `https://raw.githubusercontent.com/${owner}/${repoName}/HEAD/favicon.svg`;
}

// ── SVG Parsing ──────────────────────────────────────────────────────────────

/**
 * Parse CSS custom properties from a <style> block inside an SVG.
 * Returns a Map of var-name → value (light-mode :root only).
 */
function parseCssVars(styleText) {
  const vars = new Map();

  // Extract the light-mode :root block (before any @media)
  const rootMatch = styleText.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) return vars;

  const body = rootMatch[1];
  for (const line of body.split(";")) {
    const trimmed = line.trim();
    const m = trimmed.match(/^--([\w-]+)\s*:\s*(.+)$/);
    if (m) {
      vars.set(`--${m[1]}`, m[2].trim());
    }
  }

  return vars;
}

/**
 * Resolve a CSS value that may contain var() references.
 * E.g. "var(--gradient-start)" → actual color value.
 */
function resolveCssValue(value, vars) {
  return value.replace(/var\(([\w-]+)\)/g, (_, varName) => {
    return vars.get(varName) ?? vars.get(`--${varName}`) ?? value;
  });
}

/**
 * Convert SVG gradient coordinates to CSS linear-gradient direction.
 * Returns a string like "to bottom right", "to bottom", "to right", etc.
 */
function gradientDirectionToCSS(x1, y1, x2, y2) {
  // Normalize percentage values
  const parse = (v) => {
    if (v.endsWith("%")) return parseFloat(v) / 100;
    // Assume pixel values in 32x32 viewBox
    return parseFloat(v) / 32;
  };

  const nx1 = parse(x1);
  const ny1 = parse(y1);
  const nx2 = parse(x2);
  const ny2 = parse(y2);

  const dx = nx2 - nx1;
  const dy = ny2 - ny1;

  // Determine angle and convert to CSS direction
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // CSS linear-gradient angles: 0deg = to top, 90deg = to right, etc.
  // SVG: 0,0 is top-left, so dy>0 means downward
  const cssAngle = (angle + 90 + 360) % 360;

  // Round to nearest 45° for named directions
  const rounded = Math.round(cssAngle / 45) * 45;
  const named = {
    0: "to top",
    45: "to top right",
    90: "to right",
    135: "to bottom right",
    180: "to bottom",
    225: "to bottom left",
    270: "to left",
    315: "to top left",
    360: "to top",
  };

  return named[rounded] || `${Math.round(cssAngle)}deg`;
}

/**
 * Extract gradient CSS and icon SVG snippet from an SVG favicon string.
 * Returns { gradientCSS, iconSvg }.
 */
function extractFaviconData(svgText) {
  // Parse CSS variables from <style> blocks
  const styleBlocks = [...svgText.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])
    .join("\n");
  const vars = parseCssVars(styleBlocks);

  // Also check for CSS vars in style attribute on <svg> element
  const svgStyleMatch = svgText.match(/<svg[^>]*style="([^"]*)"/);
  if (svgStyleMatch) {
    for (const pair of svgStyleMatch[1].split(";")) {
      const m = pair.trim().match(/^(--[\w-]+)\s*:\s*(.+)$/);
      if (m) vars.set(m[1], m[2].trim());
    }
  }

  // Find the linearGradient
  const gradientMatch = svgText.match(
    /<linearGradient\s+([^>]*)>([\s\S]*?)<\/linearGradient>/
  );

  let gradientCSS = null;
  if (gradientMatch) {
    const gradAttrs = gradientMatch[1];
    const gradBody = gradientMatch[2];

    // Parse gradient attributes
    const getAttr = (name) => {
      const m = gradAttrs.match(new RegExp(`${name}="([^"]*)"`));
      return m ? m[1] : undefined;
    };

    const x1 = getAttr("x1") || "0%";
    const y1 = getAttr("y1") || "0%";
    const x2 = getAttr("x2") || "100%";
    const y2 = getAttr("y2") || "100%";

    // Parse stops
    const stops = [];
    const stopRegex = /<stop\s+([^/]+?)\/?>/g;
    let stopMatch;
    while ((stopMatch = stopRegex.exec(gradBody)) !== null) {
      const stopAttrs = stopMatch[1];
      const offsetMatch = stopAttrs.match(/offset="([^"]*)"/);
      const colorMatch =
        stopAttrs.match(/stop-color="([^"]*)"/) ||
        stopAttrs.match(/style="stop-color:([^";]+)/);

      if (colorMatch) {
        let offset = offsetMatch ? offsetMatch[1] : (stops.length === 0 ? "0%" : "100%");
        let color = colorMatch[1].trim();

        // Resolve CSS variables
        color = resolveCssValue(color, vars);

        // Normalize offset to percentage
        if (!offset.includes("%")) {
          const num = parseFloat(offset);
          offset = Number.isNaN(num) ? (stops.length === 0 ? "0%" : "100%") : `${Math.round(num * 100)}%`;
        }

        stops.push({ offset, color });
      }
    }

    // Build CSS gradient
    if (stops.length > 0) {
      const direction = gradientDirectionToCSS(x1, y1, x2, y2);
      const colorStops = stops.map((s) => `${s.color} ${s.offset}`).join(", ");
      gradientCSS = `linear-gradient(${direction}, ${colorStops})`;
    }
  }

  // Extract icon SVG (everything except background rect and defs/style),
  // independent of whether a gradient was found.
  let iconSvg = extractIconSvg(svgText, vars);

  return { gradientCSS, iconSvg };
}

/**
 * Extract the icon portion of an SVG favicon.
 * Removes: <defs>, <style>, background <rect>, and the outer <svg>.
 * Normalizes fill/stroke to white.
 */
function extractIconSvg(svgText, vars) {
  // Remove XML declaration
  let content = svgText.replace(/<\?xml[^?]*\?>\s*/g, "");

  // Remove <defs>...</defs>
  content = content.replace(/<defs[\s\S]*?<\/defs>/g, "");

  // Remove <style>...</style>
  content = content.replace(/<style[\s\S]*?<\/style>/g, "");

  // Remove background rect (the one that fills the entire SVG with the gradient)
  // This is typically: <rect ... fill="url(#...)" .../> or <rect ... fill="var(--bg-color)" .../>
  content = content.replace(
    /<rect[^>]*fill="(?:url\([^)]+\)|var\(--bg-color\))"[^>]*\/?\s*>/g,
    ""
  );

  // Remove any leftover closing </rect> tags
  content = content.replace(/<\/rect>/g, "");

  // Canonical favicons mark exactly one element with id="icon" (usually the
  // single icon path). When the marker is present, that element alone is the
  // icon source and everything else in the file is ignored.
  const markedShape = content.match(
    /<(path|circle|rect|ellipse|line|polygon|polyline)\b[^>]*\bid="icon"[^>]*>/i
  );
  const markedGroup = content.match(/<g\b[^>]*\bid="icon"[^>]*>[\s\S]*?<\/g>/i);
  const marked = markedShape || markedGroup;
  if (marked) {
    content = marked[0].replace(/(\s+)id="icon"/i, "$1");
  }

  // Before removing <svg> tags, capture inherited fill/stroke attributes
  // and geometric transforms from them. Nested <svg> elements (e.g.
  // reaction-time-test) may carry fill="none", stroke, stroke-width, and
  // a viewBox/position/size that rescales their content. We need to capture
  // all of these so the icon renders correctly after the wrapper is removed.
  const svgTagRegex = /<svg\s+([^>]*)>/g;
  let svgMatch;
  const inheritedFill = [];
  const inheritedStroke = [];
  const inheritedStrokeProps = {}; // key -> value, last svg wins
  const wrapperTransforms = []; // computed transform strings for nested <svg>
  let svgIndex = 0;
  while ((svgMatch = svgTagRegex.exec(content)) !== null) {
    const attrs = svgMatch[1];
    const fillM = attrs.match(/\bfill="([^"]*)"/);
    const strokeM = attrs.match(/\bstroke="([^"]*)"/);
    if (fillM) inheritedFill.push(fillM[1]);
    if (strokeM) inheritedStroke.push(strokeM[1]);
    for (const prop of ["stroke-width", "stroke-linecap", "stroke-linejoin"]) {
      const propM = attrs.match(new RegExp(`\\b${prop}="([^"]*)"`));
      if (propM) inheritedStrokeProps[prop] = propM[1];
    }

    // Nested <svg> elements (not the first/outer one) may have x/y/width/height
    // and a viewBox that rescale their content. Convert those into a <g>
    // transform so content keeps its position/size after the wrapper is removed.
    if (svgIndex > 0) {
      const getAttr = (name) => {
        const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
        return m ? m[1] : undefined;
      };
      const x = parseFloat(getAttr("x")) || 0;
      const y = parseFloat(getAttr("y")) || 0;
      const vbx = getAttr("viewBox")?.split(/\s+/)[2] || getAttr("width");
      const vby = getAttr("viewBox")?.split(/\s+/)[3] || getAttr("height");
      const width = parseFloat(getAttr("width")) || vbx;
      const height = parseFloat(getAttr("height")) || vby;
      const scaleX = vbx ? width / parseFloat(vbx) : 1;
      const scaleY = vby ? height / parseFloat(vby) : 1;

      let transform = "";
      // Order matters: translate first, then scale. This mirrors how a nested
      // <svg x y width height viewBox> renders: content is scaled to fit
      // width/height, then positioned at x/y.
      if (x !== 0 || y !== 0) {
        transform += `translate(${x} ${y}) `;
      }
      if (scaleX !== 1 || scaleY !== 1) {
        transform += `scale(${scaleX} ${scaleY}) `;
      }
      if (transform) wrapperTransforms.push(transform.trim());
    }
    svgIndex += 1;
  }

  // Remove outer <svg> tags, keep inner content
  content = content.replace(/<\/?svg[^>]*>/g, "");

  // Remove comments
  content = content.replace(/<!--[\s\S]*?-->/g, "");

  // Clean up whitespace
  content = content.trim();

  if (!content) return null;

  // Normalize fills and strokes to white
  // Replace var(--fg-color) and similar with #fff
  content = content.replace(/fill="var\([^)]+\)"/g, 'fill="#fff"');
  content = content.replace(/stroke="var\([^)]+\)"/g, 'stroke="#fff"');

  // Replace specific known foreground colors with white
  const fgColors = ["#ffffff", "#fff", "white", "#f5f5f5", "whitesmoke"];
  for (const color of fgColors) {
    const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    content = content.replace(
      new RegExp(`fill="${escaped}"`, "gi"),
      'fill="#fff"'
    );
    content = content.replace(
      new RegExp(`stroke="${escaped}"`, "gi"),
      'stroke="#fff"'
    );
  }

  // Replace style="fill:var(--fg-color)..." patterns
  content = content.replace(
    /style="fill:var\([^)]+\)([^"]*)"/g,
    'style="fill:#fff$1"'
  );

  // Remove class attributes (they reference removed <style> blocks)
  content = content.replace(/\s+class="[^"]*"/g, "");

  // Remove hover-related styles
  content = content.replace(/\s+transition="[^"]*"/g, "");

  // For drumpad: replace var(--pad-base) fills with white
  content = content.replace(/fill="var\(--pad-base\)"/g, 'fill="#fff"');

  // Replace fill="url(#...)" with null — these reference removed <defs> and won't render
  // (e.g. color-matcher's circle with fill="url(#gradient)")
  if (/fill="url\(/.test(content)) {
    return null;
  }

  // Propagate inherited fill/stroke from removed <svg> wrappers.
  // If a parent <svg> had fill="none", children without explicit fill
  // should get fill="none" (not the default black). If it had a stroke,
  // children without explicit stroke inherit it (normalized to #fff),
  // plus any stroke-width / linecap / linejoin.
  const parentFill = inheritedFill.length > 0 ? inheritedFill[inheritedFill.length - 1] : null;
  const parentStroke = inheritedStroke.length > 0 ? inheritedStroke[inheritedStroke.length - 1] : null;

  // Add fill/stroke to elements that lack them, using inherited values
  content = content.replace(
    /<(rect|circle|ellipse|path|polygon|polyline|line)(\s[^>]*?)?(\/?)>/g,
    (match, tag, attrs, selfClose) => {
      attrs = attrs || "";
      let result = `<${tag}`;

      // Fill: only add if element has no fill attribute and no style with fill
      if (!/\bfill=/.test(attrs) && !/style="[^"]*fill:/.test(attrs)) {
        // Use inherited fill (e.g. "none" for stroke-based icons) or default to "#fff"
        const fill = parentFill !== null ? parentFill : "#fff";
        result += ` fill="${fill}"`;
      }

      // Stroke: only add if parent had stroke and element has no stroke attribute
      if (parentStroke && !/\bstroke=/.test(attrs) && !/style="[^"]*stroke:/.test(attrs)) {
        result += ` stroke="#fff"`;
        // Also inherit stroke properties if the element lacks them
        for (const [prop, value] of Object.entries(inheritedStrokeProps)) {
          if (!new RegExp(`\\b${prop}=`).test(attrs)) {
            result += ` ${prop}="${value}"`;
          }
        }
      }

      result += `${attrs}${selfClose}>`;
      return result;
    }
  );

  // Clean up any remaining var() references we can resolve
  for (const [varName, value] of vars) {
    content = content.replaceAll(`var(${varName})`, value);
  }

  // Wrap content in a <g> with the captured transform(s) from nested <svg>
  // wrappers, so content keeps its original position/size (e.g. reaction-time
  // icon inside a 24x24 viewBox scaled to 26x26 at x=3,y=3).
  if (wrapperTransforms.length > 0 && content) {
    const transform = wrapperTransforms.join(" ");
    content = `<g transform="${transform}">\n  ${content}\n</g>`;
  }

  // Final whitespace cleanup
  content = content.replace(/\n\s*\n/g, "\n").trim();

  return content || null;
}

// ── Download ─────────────────────────────────────────────────────────────────

/** Download each project's favicon SVG into tmpDir. Mutates nothing. */
export async function downloadFavicons(projects, { owner, tmpDir = defaultTmpDir } = {}) {
  await fs.mkdir(tmpDir, { recursive: true });

  let saved = 0;
  let failed = 0;

  for (const project of projects) {
    const title = String(project.title ?? "").trim();
    const faviconUrl = resolveFaviconUrl(project, owner);

    const slug = slugify(
      title ||
        new URL(faviconUrl).pathname.split("/").filter(Boolean).pop() ||
        "favicon"
    );

    const destPath = path.join(tmpDir, `${slug}.svg`);

    try {
      const response = await fetch(faviconUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(destPath, buffer);

      console.log(`  SAVED ${faviconUrl} -> ${path.basename(destPath)}`);
      saved += 1;
    } catch (error) {
      console.error(`  FAILED ${faviconUrl}: ${error.message}`);
      failed += 1;
    }
  }

  console.log(`  Download: ${saved} saved, ${failed} failed`);
  return { saved, failed };
}

// ── Extract ──────────────────────────────────────────────────────────────────

/** Read tmpDir SVGs and set gradientCSS/iconSvg on each project (mutates projects). */
export async function extractFaviconDataFromFiles(projects, { tmpDir = defaultTmpDir } = {}) {
  let extracted = 0;
  let skipped = 0;

  for (const project of projects) {
    const title = String(project.title ?? "").trim();
    const slug = slugify(title);
    const svgPath = path.join(tmpDir, `${slug}.svg`);

    try {
      const svgText = await fs.readFile(svgPath, "utf8");
      const { gradientCSS, iconSvg } = extractFaviconData(svgText);

      if (gradientCSS) {
        project.gradientCSS = gradientCSS;
        console.log(`  GRADIENT ${slug}: ${gradientCSS}`);
      } else {
        delete project.gradientCSS;
        console.warn(`  NO GRADIENT ${slug}`);
      }

      if (iconSvg) {
        project.iconSvg = iconSvg;
        console.log(`  ICON ${slug}: ${iconSvg.substring(0, 60)}...`);
      } else {
        delete project.iconSvg;
        console.warn(`  NO ICON ${slug}`);
      }

      extracted += 1;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.warn(`  SKIP ${slug}: no SVG file at ${svgPath}`);
        skipped += 1;
      } else {
        console.error(`  ERROR ${slug}: ${error.message}`);
        skipped += 1;
      }
    }
  }

  console.log(`  Extract: ${extracted} processed, ${skipped} skipped`);
  return { extracted, skipped };
}

/** Extract favicon data into projects from downloaded SVG files (idempotent wrapper). */
export { extractFaviconData };

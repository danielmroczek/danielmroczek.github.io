import fs from "node:fs/promises";
import path from "node:path";
import { rootDir, defaultTmpDir, downloadFavicons, extractFaviconDataFromFiles } from "./lib/favicon.mjs";

const projectsPath = path.join(rootDir, "projects.json");
const tmpDir = defaultTmpDir;

/**
 * CLI wrapper around the shared favicon logic.
 * Reads projects.json, downloads favicons to tmp/ and/or extracts
 * gradient + icon data back into projects.json.
 *
 * Flags:
 *   --download-only  download favicons to tmp/ without extracting
 *   --extract-only   extract data from existing SVGs in tmp/ without downloading
 * Without flags, does both (download then extract).
 */
async function main() {
  const args = process.argv.slice(2);
  const downloadOnly = args.includes("--download-only");
  const extractOnly = args.includes("--extract-only");

  console.log("Reading projects.json...");
  const rawProjects = await fs.readFile(projectsPath, "utf8");
  const projects = JSON.parse(rawProjects);

  if (!extractOnly) {
    console.log("\nDownloading favicons...");
    await downloadFavicons(projects, { tmpDir });
  }

  if (!downloadOnly) {
    console.log("\nExtracting favicon data...");
    await extractFaviconDataFromFiles(projects, { tmpDir });

    // Remove old image/imageAlt fields
    for (const project of projects) {
      delete project.image;
      delete project.imageAlt;
    }

    // Write updated projects.json
    await fs.writeFile(
      projectsPath,
      JSON.stringify(projects, null, 2) + "\n",
      "utf8"
    );
    console.log("\nUpdated projects.json");
  }

  console.log("\nDone!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

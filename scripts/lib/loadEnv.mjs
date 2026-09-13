import fs from "node:fs";

/**
 * Load a `.env`-style file into process.env without any dependencies.
 * Does not override variables that are already set in the environment.
 * Returns the parsed key/value object.
 *
 * Supported syntax: KEY=value lines and # comments. Values are trimmed.
 */
export function loadEnvFile(filePath = ".env") {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return {};
  }

  const parsed = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([\w.]+)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
    parsed[key] = value;
  }

  return parsed;
}

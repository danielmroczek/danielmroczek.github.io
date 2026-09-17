// Import a remote browser-style script (an IIFE assigning an export onto a
// global `window`) into a Node context.
//
// Used to load shared code from the favicon-creator repo, serving
// raw.githubusercontent.com like a CDN. Node cannot `import()` an https URL,
// so the source is fetched, wrapped in a base64 `data:` URL and imported as
// a real ES module before `window.<exportName>` is read back.

export async function importWindowGlobalFromUrl(url, exportName) {
  const res = await fetch(url, { headers: { "User-Agent": "portfolio-generator" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const b64 = Buffer.from(await res.text()).toString("base64");
  globalThis.window ??= {};
  await import(`data:text/javascript;base64,${b64}`);
  const exported = globalThis.window[exportName];
  if (!exported) throw new Error(`${url} did not set window.${exportName}`);
  return exported;
}

// Builds the static GitHub Pages demo into demo-dist/.
// Usage: node scripts/build-demo.mjs [base]   (default base: /tabletap/)
import { rolldown } from "rolldown";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "demo-dist");
const base = (process.argv[2] ?? "/tabletap/").replace(/\/?$/, "/");
// Link previews need absolute URLs; set DEMO_ORIGIN when hosting elsewhere.
const site = (process.env.DEMO_ORIGIN ?? "https://iliasjf.github.io") + base;
const routes = ["menu", "admin", "qr", "credits", "privacy"];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const bundle = await rolldown({
  input: path.join(root, "scripts/demo/entry.tsx"),
  platform: "browser",
  cwd: root,
  transform: {
    jsx: "react-jsx",
    define: { "process.env.NODE_ENV": '"production"' },
  },
  plugins: [
    {
      name: "demo-css",
      load(id) {
        if (id.endsWith(".css")) return { code: "", moduleType: "js" };
      },
    },
  ],
});
await bundle.write({
  file: path.join(out, "app.js"),
  format: "es",
  minify: true,
});
await bundle.close();

const css = await Promise.all(
  ["app/globals.css", "app/admin/admin.css", "scripts/demo/demo.css"].map(
    (file) => readFile(path.join(root, file), "utf8"),
  ),
);
// Fonts and other root URLs in CSS move under the site prefix.
await writeFile(
  path.join(out, "app.css"),
  css.join("\n").replace(/url\((["']?)\//g, `url($1${base}`),
);
await cp(path.join(root, "public"), out, { recursive: true });

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><title>TableTap — café QR menu demo</title><meta name="description" content="Live demo of TableTap: a café QR menu with WhatsApp ordering, an owner dashboard, and English, French and Arabic support."><meta property="og:type" content="website"><meta property="og:title" content="TableTap — café QR menu demo"><meta property="og:description" content="Scan, choose and order on WhatsApp. Owners edit the menu in English, French and Arabic and track orders."><meta property="og:image" content="${site}og.jpg"><meta property="og:url" content="${site}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#f8f7f2"><link rel="icon" href="favicon.svg"><link rel="preload" href="fonts/cormorant-garamond.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>`;
await writeFile(path.join(out, "index.html"), html);
await writeFile(path.join(out, "404.html"), html);
for (const route of routes) {
  await mkdir(path.join(out, route), { recursive: true });
  await writeFile(path.join(out, route, "index.html"), html);
}
// Serve files as-is (no Jekyll processing).
await writeFile(path.join(out, ".nojekyll"), "");
console.log(`Demo built in demo-dist/ for ${base}`);

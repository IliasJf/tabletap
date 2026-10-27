import { rolldown } from "rolldown";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function buildPreview() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const out = path.join(root, ".sites-runtime", "preview");
  await mkdir(out, { recursive: true });
  const bundle = await rolldown({
    input: path.join(root, "scripts/preview-entry.tsx"),
    platform: "browser",
    cwd: root,
    transform: {
      jsx: "react-jsx",
      define: { "process.env.NODE_ENV": '"production"' },
    },
    plugins: [
      {
        name: "preview-css",
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
    ["app/globals.css", "app/admin/admin.css"].map((file) =>
      readFile(path.join(root, file), "utf8"),
    ),
  );
  await writeFile(path.join(out, "app.css"), css.join("\n"));
  await writeFile(
    path.join(out, "index.html"),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Olive & Ember — TableTap</title><meta name="description" content="A café QR menu and WhatsApp ordering app. TableTap portfolio project."><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
  );
  console.log("Local preview built.");
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await buildPreview();

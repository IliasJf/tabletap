// Serves demo-dist/ under /tabletap/ the way GitHub Pages does, for local checks.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  "demo-dist",
);
const base = "/tabletap/";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith(base)) {
    res.writeHead(302, { Location: base });
    return res.end();
  }
  let file = path.resolve(
    root,
    "." + decodeURIComponent(url.pathname.slice(base.length - 1)),
  );
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    if ((await stat(file)).isDirectory()) {
      // Like Pages: /tabletap/menu → /tabletap/menu/ (keeping the query).
      if (!url.pathname.endsWith("/")) {
        res.writeHead(301, { Location: url.pathname + "/" + url.search });
        return res.end();
      }
      file = path.join(file, "index.html");
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": types[".html"] });
    res.end(await readFile(path.join(root, "404.html")));
  }
}).listen(Number(process.env.PORT) || 5174, "127.0.0.1", () =>
  console.log(
    `TableTap demo: http://localhost:${process.env.PORT || 5174}${base}`,
  ),
);

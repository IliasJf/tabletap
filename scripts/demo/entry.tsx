// Entry for the static GitHub Pages demo. The app uses root paths ("/admin",
// "/images/…"); here it lives under a prefix such as "/tabletap/", so links and
// images are prefixed as they appear, and the API runs in the browser.
import { renderScreen } from "../app-screens";
import { demoImageUrl, installDemoApi, resetDemo } from "./demo-api";

const BASE = document.querySelector("base")?.getAttribute("href") ?? "/";

/** "/menu?shop=x" → "/tabletap/menu/?shop=x" (folders keep Pages from redirecting). */
function prefixed(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith(BASE))
    return path;
  const url = new URL(path, window.location.origin);
  if (url.pathname !== "/" && !/\.[a-z0-9]+$/i.test(url.pathname))
    url.pathname = url.pathname.replace(/\/?$/, "/");
  return BASE + url.pathname.slice(1) + url.search + url.hash;
}

function fixImage(img: HTMLImageElement) {
  const src = img.getAttribute("src");
  if (!src) return;
  const uploaded = demoImageUrl(src);
  if (uploaded) img.setAttribute("src", uploaded);
  else if (src !== prefixed(src)) img.setAttribute("src", prefixed(src));
}

function fixLink(link: HTMLAnchorElement) {
  const href = link.getAttribute("href");
  if (href && href !== prefixed(href))
    link.setAttribute("href", prefixed(href));
}

installDemoApi(BASE);

document.addEventListener(
  "click",
  (event) => {
    const link = (event.target as Element | null)?.closest?.("a[href]");
    const href = link?.getAttribute("href");
    if (link && href && href !== prefixed(href))
      link.setAttribute("href", prefixed(href));
  },
  true,
);

new MutationObserver((records) => {
  for (const record of records) {
    if (record.target instanceof HTMLImageElement) fixImage(record.target);
    if (record.target instanceof HTMLAnchorElement) fixLink(record.target);
    for (const node of record.addedNodes)
      if (node instanceof Element) {
        if (node instanceof HTMLImageElement) fixImage(node);
        if (node instanceof HTMLAnchorElement) fixLink(node);
        node.querySelectorAll("img").forEach(fixImage);
        node
          .querySelectorAll("a[href]")
          .forEach((a) => fixLink(a as HTMLAnchorElement));
      }
  }
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["src", "href"],
});

const badge = document.createElement("div");
badge.className = "demo-badge";
badge.innerHTML =
  '<strong>Live demo</strong><span>Changes stay in your browser.</span><button type="button">Reset demo</button><a href="https://github.com/IliasJf/tabletap" target="_blank" rel="noopener noreferrer">Code</a>';
badge.querySelector("button")!.addEventListener("click", () => {
  if (
    window.confirm(
      "Reset the demo? Your saved menu, photos and orders in this browser will be cleared.",
    )
  ) {
    resetDemo();
    window.location.href = BASE;
  }
});
document.body.appendChild(badge);

const path = window.location.pathname.startsWith(BASE)
  ? "/" + window.location.pathname.slice(BASE.length)
  : window.location.pathname;
renderScreen(path.length > 1 ? path.replace(/\/$/, "") : path);

// The built site: every page loads and is well formed, diagrams are accessible in the HTML itself,
// the social tags are right. With --live it also checks what only a real deployment has: the
// section-root redirects, response headers, HTTPS, and the sitemap against the live domain.
// Usage: node e2e/site.mjs [--live]      (SITE_URL=https://... when the build had it)
import { BASE, SECTIONS, finish, pages, pool } from "./lib.mjs";

const live = process.argv.includes("--live");
const site = process.env.SITE_URL?.replace(/\/$/, "");
const failures = [];
const get = (path, init) => fetch(BASE + path, { redirect: "manual", ...init });

// every page
const list = pages();
await pool(list, 8, async (path) => {
  const r = await get(path);
  if (r.status !== 200) return failures.push(`${path}: HTTP ${r.status}`);
  const html = await r.text();
  const home = path === "/";
  if (!/<title>[^<]+<\/title>/.test(html)) failures.push(`${path}: no <title>`);
  if (!home && !/<h1\b/.test(html)) failures.push(`${path}: no <h1>`);
  const desc = (html.match(/<meta name="description"/g) ?? []).length;
  if (desc !== 1) failures.push(`${path}: ${desc} description tags (want 1)`);
  if (!/<meta property="og:title"/.test(html)) failures.push(`${path}: no og:title`);
  const notice = /class="doc-notice"/.test(html);
  if (home && notice) failures.push(`${path}: the snapshot note must not be on the home page`);
  if (!home && !notice) failures.push(`${path}: no snapshot note`);
  // diagrams: one image each, named, with no Graphviz noise, already in the server-rendered HTML
  const figs = (html.match(/<figure class="diagram">/g) ?? []).length;
  const imgs = (html.match(/<div role="img"/g) ?? []).length;
  if (figs !== imgs) failures.push(`${path}: ${figs} diagrams but ${imgs} role=img`);
  if (/<figure class="diagram">[\s\S]*?(<title>|<\?xml|<!DOCTYPE)/.test(html)) failures.push(`${path}: Graphviz title/prolog left in a diagram`);
  if (/Missing diagram:/.test(html)) failures.push(`${path}: a diagram is missing`);
  if (site) {
    const url = site + (home ? "/" : path);
    if (!html.includes(`<link rel="canonical" href="${url}">`)) failures.push(`${path}: canonical is not ${url}`);
    if (!html.includes(`content="${site}/og.png"`)) failures.push(`${path}: og:image is not ${site}/og.png`);
  }
});

// not found, and the static files
const nf = await get("/definitely-not-a-page");
if (nf.status !== 404) failures.push(`unknown path: HTTP ${nf.status} (want 404)`);
else if (!/<title>404/.test(await nf.text())) failures.push("unknown path: not the 404 page");
for (const [path, type] of [["/favicon.svg", "image/svg+xml"], ["/favicon-32.png", "image/png"], ["/apple-touch-icon.png", "image/png"], ["/og.png", "image/png"], ["/robots.txt", "text/plain"]]) {
  const r = await get(path);
  if (r.status !== 200) failures.push(`${path}: HTTP ${r.status}`);
  else if (!(r.headers.get("content-type") ?? "").startsWith(type)) failures.push(`${path}: content-type ${r.headers.get("content-type")}`);
  else if (path === "/og.png") {
    const b = Buffer.from(await r.arrayBuffer());
    if (b.readUInt32BE(16) !== 1200 || b.readUInt32BE(20) !== 630) failures.push(`/og.png is ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}, want 1200x630`);
  }
}
if (site) {
  const sm = await get("/sitemap.xml");
  const urls = sm.status === 200 ? [...(await sm.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) : [];
  if (urls.length !== list.length) failures.push(`sitemap lists ${urls.length} URLs, the site has ${list.length} pages`);
  if (urls.some((u) => !u.startsWith(site))) failures.push("sitemap has URLs outside " + site);
}

if (live) {
  // section roots send you to the section's first page (Cloudflare _redirects; a local preview can't do this)
  for (const [dir, first] of Object.entries(SECTIONS))
    for (const p of [`/${dir}`, `/${dir}/`]) {
      const r = await get(p);
      const to = r.headers.get("location") ?? "";
      if (r.status !== 302 || !to.endsWith(`/${dir}/${first}`)) failures.push(`${p}: ${r.status} -> ${to || "(no redirect)"}, want 302 -> /${dir}/${first}`);
    }
  const home = await get("/");
  const h = (n) => home.headers.get(n);
  if (h("x-content-type-options") !== "nosniff") failures.push("missing X-Content-Type-Options: nosniff");
  if (h("referrer-policy") !== "strict-origin-when-cross-origin") failures.push("missing the Referrer-Policy header");
  const css = (await (await get("/")).text()).match(/\/assets\/[^"> ,;]+\.css/)?.[0];
  const cc = css ? (await get(css)).headers.get("cache-control") : null;
  if (!cc?.includes("immutable")) failures.push(`${css}: cache-control "${cc}" is not immutable`);
  if (BASE.startsWith("https://")) {
    const r = await fetch(BASE.replace("https://", "http://") + "/", { redirect: "manual" });
    if (r.status !== 301 && r.status !== 308) failures.push(`http:// does not redirect to https (HTTP ${r.status})`);
  }
}
console.log(`site: ${list.length} pages${live ? " + live checks" : ""} (${BASE})`);
finish("site", failures);

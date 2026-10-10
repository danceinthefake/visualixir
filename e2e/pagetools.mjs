// Page tools: "Read first" and "Related pages" match docs/.vitepress/related.json and link to real pages,
// and the Under the hood controls (Open all, Close all, Always open them) work and are remembered.
import { readFileSync } from "node:fs";
import { BASE, docs, finish, launch, open, pages, pool } from "./lib.mjs";

const rel = JSON.parse(readFileSync(docs + ".vitepress/related.json", "utf8")).pages;
const browser = await launch();
const failures = [];
const list = pages().filter((p) => p !== "/");
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const workers = await Promise.all(Array.from({ length: 4 }, () => ctx.newPage()));

await pool(list, workers.length, async (path, _i, worker) => {
  const page = workers[worker];
  await open(page, path);
  const e = rel[path.slice(1)] ?? {};
  const want = (e.related ?? []).length;
  const got = await page.locator("nav.related-pages li a").count();
  if (got !== want) failures.push(`${path}: ${got} related links, related.json has ${want}`);
  const first = await page.locator(".page-tools__first a").count();
  if (first !== (e.first ?? []).length) failures.push(`${path}: ${first} read-first links, related.json has ${(e.first ?? []).length}`);
  for (const href of await page.locator("nav.related-pages a, .page-tools__first a").evaluateAll((a) => a.map((x) => x.getAttribute("href"))))
    if (!list.includes(href)) failures.push(`${path}: a link goes to ${href}, which is not a page`);
  if (!want && path !== "/glossary" && path !== "/paths" && !Object.hasOwn(rel, path.slice(1))) failures.push(`${path}: not in related.json`);
});

// the controls, on a page with several Under the hood sections
const many = await Promise.all(
  list.map(async (p) => {
    const html = await (await fetch(BASE + p)).text();
    return [p, (html.match(/class="bless-collapsible under-the-hood/g) ?? []).length];
  }),
);
const target = many.filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0];
if (!target) failures.push("no page has two Under the hood sections");
else {
  const [path, n] = target;
  const page = await ctx.newPage();
  await open(page, path);
  const openCount = () => page.locator("details.under-the-hood[open]").count();
  if (await openCount()) failures.push(`${path}: sections start open`);
  await page.getByRole("button", { name: "Open all" }).click();
  await page.waitForTimeout(200);
  if ((await openCount()) !== n) failures.push(`${path}: Open all opened ${await openCount()} of ${n}`);
  await page.getByRole("button", { name: "Close all" }).click();
  await page.waitForTimeout(200);
  if (await openCount()) failures.push(`${path}: Close all left ${await openCount()} open`);
  await page.getByLabel("Always open them").check();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if ((await openCount()) !== n) failures.push(`${path}: "Always open them" was not remembered (${await openCount()} of ${n} open after a reload)`);
  await page.getByLabel("Always open them").uncheck();
  await page.getByRole("button", { name: "Close all" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if (await openCount()) failures.push(`${path}: turning it off was not remembered`);
}
await ctx.close();
await browser.close();
console.log(`pagetools: ${list.length} pages, controls on ${target?.[0]} (${BASE})`);
finish("pagetools", failures);

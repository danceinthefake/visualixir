// Reading progress: Mark as read toggles, is remembered across a reload, ticks the sidebar and /paths, and can be cleared.
import { readFileSync } from "node:fs";
import { BASE, docs, finish, launch, open, pages } from "./lib.mjs";

const tracks = JSON.parse(readFileSync(docs + ".vitepress/paths.json", "utf8")).tracks;
const browser = await launch();
const failures = [];
const list = pages();
for (const t of tracks) for (const s of t.steps) if (!list.includes("/" + s)) failures.push(`paths.json: ${s} is not a page`);

const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
const a = tracks[0].steps[1]; // a page in the first track
await open(page, "/paths");
if ((await page.locator(".paths__track").count()) !== tracks.length) failures.push("/paths does not show every track");
for (const t of tracks) if (!(await page.locator(`#path-${t.id}`).count())) failures.push(`/paths has no heading for ${t.id}`);
const count0 = await page.locator(".paths__count").first().innerText();
if (!/^0 of \d+ read$/.test(count0.trim())) failures.push(`fresh progress reads "${count0}"`);

await open(page, "/" + a);
const btn = page.getByRole("button", { name: /Mark as read|Marked as read/ });
if ((await btn.getAttribute("aria-pressed")) !== "false") failures.push(`${a}: the toggle starts pressed`);
await btn.click();
if ((await btn.getAttribute("aria-pressed")) !== "true") failures.push(`${a}: clicking did not mark it as read`);
await page.waitForTimeout(200);
const tick = await page.locator(`.VPSidebar a.link.is-read[href="/${a}"]`).count();
if (!tick && (await page.locator(".VPSidebar a.link").count())) failures.push(`${a}: the sidebar link is not ticked`);

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
if ((await page.getByRole("button", { name: /Marked as read/ }).getAttribute("aria-pressed")) !== "true") failures.push(`${a}: not remembered after a reload`);

await open(page, "/paths");
await page.waitForTimeout(300);
const count1 = (await page.locator(".paths__count").first().innerText()).trim();
if (!/^1 of \d+ read$/.test(count1)) failures.push(`/paths shows "${count1}" after one page`);
if (!(await page.locator(".paths__steps li.is-read").count())) failures.push("/paths does not tick the page");
const cont = await page.locator(".paths__continue").first().getAttribute("href");
if (!cont || cont === "/" + a) failures.push(`Continue points at ${cont}`);

await page.getByRole("button", { name: "Clear my progress" }).click();
await page.waitForTimeout(200);
if (!/^0 of/.test((await page.locator(".paths__count").first().innerText()).trim())) failures.push("Clear my progress did not clear");
await open(page, "/" + a);
if ((await page.getByRole("button", { name: /Mark as read/ }).getAttribute("aria-pressed")) !== "false") failures.push(`${a}: still marked after clearing`);

// every content page has the toggle, our own pages and the home page don't
for (const p of ["/", "/glossary", "/paths", "/modules/task"]) {
  await open(page, p);
  const has = await page.locator(".read-toggle").count();
  const want = p === "/modules/task" ? 1 : 0;
  if (has !== want) failures.push(`${p}: ${has} read toggles, want ${want}`);
}
await browser.close();
console.log(`paths: ${tracks.length} tracks, ${tracks.reduce((n, t) => n + t.steps.length, 0)} steps (${BASE})`);
finish("paths", failures);

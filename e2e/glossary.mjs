// Glossary cards: every page's first card opens on hover (mouse), on Enter (keyboard) and on tap (phone), stays inside the
// screen, closes on Escape or a tap elsewhere, and every card links to a term that exists on /glossary. axe runs with a card open.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { BASE, finish, launch, open, pages, pool } from "./lib.mjs";

const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await launch();
const failures = [];
const list = pages().filter((p) => p !== "/");

// the terms on /glossary
const gp = await (await browser.newContext()).newPage();
await open(gp, "/glossary");
const known = new Set(await gp.locator("dt[id]").evaluateAll((els) => els.map((e) => e.id)));
if (known.size < 20) failures.push(`/glossary lists only ${known.size} terms`);
if (await gp.locator(".gloss__term").count()) failures.push("/glossary has cards of its own");
const used = new Set();
let cards = 0;

for (const kind of ["desktop", "phone"]) {
  const phone = kind === "phone";
  const ctx = await browser.newContext({ viewport: { width: phone ? 390 : 1200, height: 800 }, isMobile: phone, hasTouch: phone });
  const workers = await Promise.all(Array.from({ length: 4 }, () => ctx.newPage()));
  await pool(list, workers.length, async (path, _i, worker) => {
    const page = workers[worker];
    await open(page, path);
    const terms = page.locator(".gloss__term:visible"); // those in a closed Under the hood section are not shown yet
    const n = await terms.count();
    if (!n) return;
    // all card links point at real terms
    for (const href of await page.locator(".gloss__card a[href*='/glossary#']").evaluateAll((a) => a.map((x) => x.getAttribute("href"))))
      if (!known.has(href.split("#")[1])) failures.push(`${path}: a card links to ${href}, which is not on /glossary`);
      else used.add(href.split("#")[1]);
    const t = terms.first();
    await t.scrollIntoViewIfNeeded();
    const card = t.locator("xpath=following-sibling::span[@popover]");
    const shown = () => card.evaluate((c) => c.matches(":popover-open"));
    const inside = async () => {
      const b = await card.boundingBox();
      const v = page.viewportSize();
      return b && b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1;
    };
    // A slow browser may not have hydrated the page yet when the pointer arrives: try once more before calling it a failure.
    let opened = false;
    for (let attempt = 0; attempt < 2 && !opened; attempt++) {
      if (attempt) { await page.mouse.move(2, 2); await page.waitForTimeout(500); }
      if (phone) await t.tap(); else await t.hover();
      try { await card.waitFor({ state: "visible", timeout: 2000 }); opened = true; } catch {}
    }
    if (!opened) { failures.push(`${path} [${kind}]: the card did not open`); return; }
    cards++;
    if (!(await inside())) failures.push(`${path} [${kind}]: the card is not inside the screen`);
    if (!((await card.innerText()).trim().length > 40)) failures.push(`${path} [${kind}]: the card is empty`);
    if (!phone) {
      await page.mouse.move(2, 2);
      await page.waitForTimeout(700);
      if (await shown()) failures.push(`${path}: the card stayed open after the mouse left`);
      await t.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      if (!(await shown())) failures.push(`${path}: Enter on the term did not open the card`);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    if (await shown()) failures.push(`${path} [${kind}]: Escape did not close the card`);
    if (phone) {
      await t.tap();
      await page.waitForTimeout(100);
      // the page margin, at a height the card does not cover (a card can sit anywhere, and a tap on it is not "elsewhere")
      const b = await card.boundingBox();
      const y = [120, 400, 650, 780].find((y) => !b || y < b.y - 8 || y > b.y + b.height + 8);
      await page.touchscreen.tap(5, y);
      await page.waitForTimeout(100);
      if (await shown()) failures.push(`${path} [phone]: a tap elsewhere did not close the card`);
    }
  });
  await ctx.close();
}

// axe with a card open, light and dark
for (const scheme of ["light", "dark"]) {
  const c = await browser.newContext({ viewport: { width: 1200, height: 800 }, colorScheme: scheme });
  const page = await c.newPage();
  for (const path of ["/getting-started/processes", "/modules/task", "/glossary"]) {
    await open(page, path);
    await page.addScriptTag({ content: axeSrc });
    const t = page.locator(".gloss__term").first();
    if (await t.count()) { await t.scrollIntoViewIfNeeded(); await t.click(); await page.waitForTimeout(150); }
    const r = await page.evaluate(() => axe.run(document, { resultTypes: ["violations"] }));
    for (const v of r.violations) failures.push(`${path} [${scheme}, card open] ${v.id} (${v.impact}): ${v.help} e.g. ${v.nodes[0].target.join(" ")}`);
  }
  await c.close();
}
await browser.close();
const unused = [...known].filter((id) => !used.has(id));
if (unused.length) failures.push(`terms no page triggers a card for: ${unused.join(", ")}`);
if (cards < 20) failures.push(`only ${cards} cards were exercised`);
console.log(`glossary: ${cards} cards on desktop and phone, ${used.size}/${known.size} terms have a card somewhere (${BASE})`);
finish("glossary", failures);

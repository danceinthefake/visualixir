// Accessibility: axe-core on every page, light and dark. Fails on any violation.
// Usage: node e2e/axe.mjs [--width 1200]   (390 = phone: also catches scrollable regions without keyboard access)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { BASE, finish, launch, open, pages, pool } from "./lib.mjs";

const width = Number(process.argv[process.argv.indexOf("--width") + 1]) || 1200;
const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const phone = width < 600;
const browser = await launch();
const failures = [];
const list = pages();

for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: phone, hasTouch: phone, colorScheme: scheme });
  const workers = await Promise.all(Array.from({ length: 4 }, () => ctx.newPage()));
  await pool(list, workers.length, async (path, _i, worker) => {
    const page = workers[worker]; // one page per worker slot, never shared
    await open(page, path);
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(() => axe.run(document, { resultTypes: ["violations"] }));
    for (const v of r.violations)
      failures.push(`${path} [${scheme}, ${width}px] ${v.id} (${v.impact}): ${v.help} e.g. ${v.nodes[0].target.join(" ")}`);
  });
  await ctx.close();
}
await browser.close();
console.log(`axe: ${list.length} pages x 2 themes at ${width}px (${BASE})`);
finish("axe", failures);

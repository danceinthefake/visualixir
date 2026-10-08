// Diagram features: the Enlarge dialog on every diagram, and Step through where a diagram opts in (<Diagram steps />).
// Also runs axe with a dialog open and with a diagram half-stepped, the states a reader can reach but axe never sees by itself.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { BASE, finish, launch, open, openAll, pages, pool } from "./lib.mjs";

const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await launch();
const failures = [];
const list = pages().filter((p) => p !== "/");
const stepped = [];

const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const workers = await Promise.all(Array.from({ length: 4 }, () => ctx.newPage()));
await pool(list, workers.length, async (path, _i, worker) => {
  const page = workers[worker];
  await open(page, path);
  await openAll(page); // diagrams inside Under the hood sections too
  const figs = await page.locator("figure.diagram").count();
  if (!figs) return;
  // Enlarge: the first diagram of the page
  const btn = page.locator("figure.diagram .diagram__enlarge").first();
  const name = await btn.getAttribute("aria-label");
  if (!name?.startsWith("Enlarge diagram")) failures.push(`${path}: the enlarge button has no name (${name})`);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  const dlg = page.locator("dialog.diagram-dialog[open]").first();
  if (!(await dlg.count())) { failures.push(`${path}: the dialog did not open`); return; }
  if (!(await dlg.locator("svg").count())) failures.push(`${path}: the dialog has no diagram`);
  const w0 = await dlg.locator(".diagram-dialog__body svg").evaluate((s) => s.getBoundingClientRect().width);
  await dlg.getByRole("button", { name: "Zoom in" }).click();
  await dlg.getByRole("button", { name: "Zoom in" }).click();
  const w1 = await dlg.locator(".diagram-dialog__body svg").evaluate((s) => s.getBoundingClientRect().width);
  if (!(w1 > w0)) failures.push(`${path}: zoom in did not enlarge the diagram (${w0} -> ${w1})`);
  await dlg.getByRole("button", { name: "Fit" }).click();
  await page.keyboard.press("Escape");
  if (await page.locator("dialog.diagram-dialog[open]").count()) failures.push(`${path}: Escape did not close the dialog`);
  const back = await btn.evaluate((b) => document.activeElement === b);
  if (!back) failures.push(`${path}: focus did not return to the enlarge button`);

  // Step through
  const stepBox = page.locator("figure.diagram--steps");
  for (let k = 0; k < (await stepBox.count()); k++) {
    stepped.push(path);
    const f = stepBox.nth(k);
    const total = await f.locator(":scope > div[role=img] g.edge[id^=step]").count();
    const next = f.getByRole("button", { name: /Step through|Next step/ });
    for (let n = 1; n <= total; n++) {
      await next.click();
      const now = await f.locator(":scope > div[role=img] g.edge.step-now").count();
      const seen = await f.locator(":scope > div[role=img] g.edge.step-seen").count();
      const text = (await f.locator(".diagram__step").innerText()).trim();
      if (now !== 1 || seen !== n - 1) failures.push(`${path}: step ${n}/${total}: ${now} current and ${seen} seen arrows`);
      if (!text.startsWith(`Step ${n} of ${total}:`) || text.length < 16) failures.push(`${path}: step ${n} text is "${text}"`);
    }
    if (!(await next.isDisabled())) failures.push(`${path}: Next step is still enabled after the last step`);
    await f.getByRole("button", { name: "Reset" }).click();
    if (await f.locator(":scope > div[role=img] g.edge.step-now, :scope > div[role=img] g.edge.step-seen").count()) failures.push(`${path}: Reset left arrows highlighted`);
  }
});
await ctx.close();

// axe in the reachable states, light and dark
for (const scheme of ["light", "dark"]) {
  const c = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: scheme });
  const page = await c.newPage();
  for (const path of [...new Set(stepped)].slice(0, 3)) {
    await open(page, path);
    await page.addScriptTag({ content: axeSrc });
    const f = page.locator("figure.diagram--steps").first();
    await f.scrollIntoViewIfNeeded();
    await f.getByRole("button", { name: "Step through" }).click();
    await f.getByRole("button", { name: "Next step" }).click();
    for (const state of ["stepping", "dialog"]) {
      if (state === "dialog") await f.locator(".diagram__enlarge").click();
      const r = await page.evaluate(() => axe.run(document, { resultTypes: ["violations"] }));
      for (const v of r.violations) failures.push(`${path} [${scheme}, ${state}] ${v.id} (${v.impact}): ${v.help} e.g. ${v.nodes[0].target.join(" ")}`);
    }
  }
  await c.close();
}
await browser.close();
console.log(`diagrams: enlarge on ${list.length} pages, ${stepped.length} step-through diagrams (${BASE})`);
if (!stepped.length) failures.push("no diagram with steps found");
finish("diagrams", failures);

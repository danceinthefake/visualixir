// "Check yourself": every page in docs/.vitepress/quiz.json ends with its questions, each answer opens and closes, and no other page has the section.
import { readFileSync } from "node:fs";
import { docs, finish, launch, open, pages, pool } from "./lib.mjs";

const quiz = JSON.parse(readFileSync(docs + ".vitepress/quiz.json", "utf8")).pages;
const browser = await launch();
const failures = [];
const list = pages().filter((p) => p !== "/");
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const workers = await Promise.all(Array.from({ length: 4 }, () => ctx.newPage()));
await pool(list, workers.length, async (path, _i, worker) => {
  const page = workers[worker];
  await open(page, path);
  const want = quiz[path.slice(1)] ?? [];
  const sec = page.locator("section.check");
  if (!want.length) {
    if (await sec.count()) failures.push(`${path}: has a Check yourself section but quiz.json has no questions for it`);
    return;
  }
  if ((await sec.count()) !== 1) return failures.push(`${path}: no Check yourself section`);
  const items = sec.locator("details.check__item");
  if ((await items.count()) !== want.length) failures.push(`${path}: ${await items.count()} questions, quiz.json has ${want.length}`);
  // it is the last thing in the article, before the related pages
  const last = await page.evaluate(() => {
    const s = document.querySelector("section.check");
    return !!s && !s.nextElementSibling?.matches("h1, h2, h3, p, ul, ol, pre, figure, details");
  });
  if (!last) failures.push(`${path}: the section is not at the end of the page`);
  for (let k = 0; k < want.length; k++) {
    const it = items.nth(k);
    const ans = it.locator(".check__answer");
    if (await ans.isVisible()) failures.push(`${path}: answer ${k + 1} is visible before it is opened`);
    await it.locator("summary").click();
    if (!(await ans.isVisible()) || (await ans.innerText()).trim().length < 10) failures.push(`${path}: answer ${k + 1} did not open`);
    await it.locator("summary").click();
    if (await ans.isVisible()) failures.push(`${path}: answer ${k + 1} did not close`);
  }
});
await ctx.close();
await browser.close();
console.log(`check: ${Object.keys(quiz).length} pages with questions`);
finish("check", failures);

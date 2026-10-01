// Local search: finds the right section for real queries, and works from the keyboard.
import { BASE, finish, launch, open } from "./lib.mjs";

// query -> a result href that must be among the top three (a path prefix, or path#section)
const cases = [
  ["pin operator", "/getting-started/pattern-matching#the-pin-operator"],
  ["GenServer", "/mix-and-otp/genservers"],
  ["MatchError", "/getting-started/pattern-matching"],
  ["quote unquote", "/meta-programming/quote-and-unquote"],
  ["chunk_every", "/cheatsheets/enum-cheat#chunking"],
  ["defguard", "/references/patterns-and-guards#custom-guards"],
  ["typespec", "/references/typespecs"],
  ["atom garbage collected", "/anti-patterns/code-anti-patterns#dynamic-atom-creation"],
  ["precedence", "/references/operators#precedence-and-associativity"],
  ["mix release", "/mix-and-otp/releases"],
];
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const failures = [];
await open(page, "/");
await page.keyboard.press("Control+k");
const box = page.locator(".VPLocalSearchBox input").first();
await box.waitFor({ timeout: 5000 }).catch(() => failures.push("Ctrl+K does not open the search box"));
if (!(await box.evaluate((e) => e === document.activeElement).catch(() => false))) failures.push("the search input is not focused on open");

const top = async (q) => {
  await box.fill("");
  await box.fill(q);
  await page.waitForTimeout(700);
  return page.locator(".VPLocalSearchBox li a").evaluateAll((a) => a.slice(0, 3).map((x) => x.getAttribute("href")));
};
for (const [q, want] of cases) {
  const hrefs = await top(q);
  if (!hrefs.some((h) => h && h.startsWith(want))) failures.push(`"${q}": wanted ${want} in the top 3, got ${JSON.stringify(hrefs)}`);
}
if ((await top("zzzzqq")).length) failures.push('"zzzzqq" should find nothing');

await top("GenServer");
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForURL(/\/mix-and-otp\/genservers/, { timeout: 5000 }).catch(() => failures.push("Enter does not open the result"));
await page.keyboard.press("Control+k");
await page.keyboard.press("Escape");
if (await page.locator(".VPLocalSearchBox").isVisible().catch(() => false)) failures.push("Escape does not close the search box");
await browser.close();
console.log(`search: ${cases.length} queries (${BASE})`);
finish("search", failures);

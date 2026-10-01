// Shared helpers for the e2e checks. They run against a built site served by `vitepress preview`
// (see e2e/run.mjs), or against any deployment with BASE_URL=https://...
import { chromium } from "playwright";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const BASE = (process.env.BASE_URL ?? "http://localhost:4173").replace(/\/$/, "");
export const docs = fileURLToPath(new URL("../docs/", import.meta.url));

// our section directory -> the first page of the section (what the bare section path redirects to)
export const SECTIONS = {
  "getting-started": "introduction",
  "mix-and-otp": "introduction-to-mix",
  "meta-programming": "quote-and-unquote",
  "anti-patterns": "what-anti-patterns",
  cheatsheets: "enum-cheat",
  references: "compatibility-and-deprecations",
};

/** "/" plus every content page, taken from the source tree. */
export function pages() {
  const out = ["/"];
  for (const dir of Object.keys(SECTIONS))
    for (const f of readdirSync(docs + dir).filter((f) => f.endsWith(".md")).sort()) out.push(`/${dir}/${f.slice(0, -3)}`);
  return out;
}

// CHROMIUM=/usr/bin/chromium uses a system browser instead of Playwright's download.
export const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM || undefined });

/** Run fn over items, n at a time. fn gets (item, index, workerId): workerId is stable per slot, so a worker can own a page. */
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async (_, worker) => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k, worker);
      }
    }),
  );
  return out;
}

/** Open a page and let it hydrate. Some pages never go network-idle, the DOM is what matters. */
export async function open(page, path) {
  await page
    .goto(BASE + path, { waitUntil: "networkidle", timeout: 20000 })
    .catch(() => page.waitForLoadState("domcontentloaded"));
  await page.waitForTimeout(300);
}

export function finish(name, failures) {
  if (failures.length) {
    console.error(`\n${name}: ${failures.length} problem(s)`);
    for (const f of failures.slice(0, 40)) console.error("  - " + f);
    if (failures.length > 40) console.error(`  ... and ${failures.length - 40} more`);
    process.exit(1);
  }
  console.log(`${name}: ok`);
}

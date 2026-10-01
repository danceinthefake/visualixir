#!/usr/bin/env node
// Renders the raster assets in docs/public from their sources:
//   favicon.svg  ->  favicon-32.png, apple-touch-icon.png
//   scripts/og.html  ->  og.png (1200x630, the social preview image)
// Run after changing the mark or the card: pnpm assets   (CHROMIUM=/usr/bin/chromium uses a system browser)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pub = fileURLToPath(new URL("../docs/public/", import.meta.url));
const svg = readFileSync(pub + "favicon.svg", "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });

for (const [size, file] of [[180, "apple-touch-icon.png"], [32, "favicon-32.png"]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: pub + file });
  await page.close();
}
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.goto(new URL("./og.html", import.meta.url).href);
await og.waitForTimeout(500);
await og.screenshot({ path: pub + "og.png" });
await browser.close();
console.log("wrote favicon-32.png, apple-touch-icon.png, og.png in docs/public");

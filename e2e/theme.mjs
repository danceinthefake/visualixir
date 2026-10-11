// The theme switch works: a click flips the page between light and dark (page and diagram colors),
// and a second click flips it back. The knob must sit inside the switch.
import { BASE, finish, launch, open } from "./lib.mjs";

const browser = await launch();
const failures = [];
const path = "/getting-started/processes";

const state = (page) =>
  page.evaluate(() => {
    const node = document.querySelector("figure.diagram svg g.node polygon, figure.diagram svg g.node path, figure.diagram svg g.node ellipse");
    const sw = document.querySelector(".VPNavBarAppearance .VPSwitchAppearance")?.getBoundingClientRect();
    const knob = document.querySelector(".VPNavBarAppearance .VPSwitchAppearance .check")?.getBoundingClientRect();
    return {
      dark: document.documentElement.classList.contains("dark"),
      bg: getComputedStyle(document.body).backgroundColor,
      fill: node ? getComputedStyle(node).fill : "",
      inside: !!sw && !!knob && knob.left >= sw.left - 1 && knob.right <= sw.right + 1 && knob.top >= sw.top - 1 && knob.bottom <= sw.bottom + 1,
    };
  });

for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 800 } });
  const page = await ctx.newPage();
  await open(page, path);
  const before = await state(page);
  if (!before.inside) failures.push(`${scheme}: the switch knob is outside the switch`);
  await page.locator(".VPNavBarAppearance .VPSwitchAppearance").click();
  await page.waitForTimeout(400);
  const flipped = await state(page);
  if (flipped.dark === before.dark) failures.push(`${scheme}: a click does not change the theme`);
  if (flipped.bg === before.bg) failures.push(`${scheme}: the page color does not change`);
  if (flipped.fill === before.fill) failures.push(`${scheme}: the diagram color does not change`);
  await page.locator(".VPNavBarAppearance .VPSwitchAppearance").click();
  await page.waitForTimeout(400);
  const back = await state(page);
  if (back.dark !== before.dark || back.bg !== before.bg) failures.push(`${scheme}: a second click does not restore the theme`);
  await ctx.close();
}
await browser.close();
console.log(`theme: light and dark (${BASE})`);
finish("theme", failures);

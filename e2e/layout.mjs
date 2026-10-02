// Phone layout: at 390px and 320px (WCAG reflow) no page scrolls sideways, diagram text stays readable,
// and a diagram that scrolls sideways can be reached with the keyboard.
import { BASE, finish, launch, open, openAll, pages, pool } from "./lib.mjs";

const browser = await launch();
const failures = [];
const list = pages();

for (const width of [390, 320]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  const workers = await Promise.all(Array.from({ length: 4 }, () => ctx.newPage()));
  await pool(list, workers.length, async (path, _i, worker) => {
    const page = workers[worker];
    await open(page, path);
    await openAll(page); // diagrams in collapsibles must scroll and stay readable too
    const r = await page.evaluate(() => {
      const vw = innerWidth;
      const wide = [...document.querySelectorAll(".vp-doc *")]
        .filter((e) => e.getBoundingClientRect().right > vw + 1 && !e.closest("pre, table, svg, figure.diagram, .vp-code-group"))
        .slice(0, 2)
        .map((e) => e.tagName.toLowerCase() + "." + e.className);
      // graphviz svg text is ~18.7px at natural size: effective size = rendered width / viewBox width * 18.7
      const tiny = [...document.querySelectorAll("figure.diagram svg")]
        .map((s) => (s.viewBox.baseVal.width ? (s.getBoundingClientRect().width / s.viewBox.baseVal.width) * 18.7 : 99))
        .filter((px) => px < 10)
        .map((px) => px.toFixed(1));
      const unfocusable = [...document.querySelectorAll("figure.diagram > div")]
        .filter((e) => e.scrollWidth > e.clientWidth && e.getAttribute("tabindex") !== "0").length;
      return { page: document.documentElement.scrollWidth > vw + 1, wide, tiny, unfocusable };
    });
    if (r.page) failures.push(`${path} @${width}px: the page scrolls sideways (${r.wide.join(", ") || "?"})`);
    if (r.tiny.length) failures.push(`${path} @${width}px: diagram text under 10px (${r.tiny.join(", ")})`);
    if (r.unfocusable) failures.push(`${path} @${width}px: ${r.unfocusable} sideways-scrolling diagram(s) not keyboard-focusable`);
  });
  await ctx.close();
}
await browser.close();
console.log(`layout: ${list.length} pages at 390px and 320px (${BASE})`);
finish("layout", failures);

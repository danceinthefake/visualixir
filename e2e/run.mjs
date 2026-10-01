// Builds nothing: serves docs/.vitepress/dist with `vitepress preview` and runs the checks.
//   node e2e/run.mjs                 everything
//   node e2e/run.mjs site search     just those (site, layout, search, axe, axe-phone)
// With BASE_URL set it checks that site instead and starts no server (add --live for deployment checks).
import { spawn, spawnSync } from "node:child_process";

const all = ["site", "layout", "search", "axe", "axe-phone"];
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const tasks = wanted.length ? wanted : all;
const extra = process.argv.slice(2).filter((a) => a.startsWith("--"));
const cmd = {
  site: ["e2e/site.mjs", ...extra],
  layout: ["e2e/layout.mjs"],
  search: ["e2e/search.mjs"],
  axe: ["e2e/axe.mjs", "--width", "1200"],
  "axe-phone": ["e2e/axe.mjs", "--width", "390"],
};
let server;
if (!process.env.BASE_URL) {
  const port = 4173;
  server = spawn("pnpm", ["exec", "vitepress", "preview", "docs", "--port", String(port)], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
}
let failed = 0;
for (const t of tasks) {
  if (!cmd[t]) { console.error(`unknown check: ${t} (${all.join(", ")})`); failed++; continue; }
  failed += spawnSync("node", cmd[t], { stdio: "inherit" }).status ? 1 : 0;
}
server?.kill();
process.exit(failed ? 1 : 0);

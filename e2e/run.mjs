// Builds nothing: serves docs/.vitepress/dist with `vitepress preview` and runs the checks.
//   node e2e/run.mjs                 everything
//   node e2e/run.mjs site search     just those (site, layout, search, axe, axe-phone)
// With BASE_URL set it checks that site instead and starts no server (add --live for deployment checks).
import { spawn, spawnSync } from "node:child_process";
import { openSync } from "node:fs";

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
  // The server's output goes to a file so a failed run leaves evidence. Detached: it is a grandchild of pnpm,
  // so we kill the whole group at the end, or it outlives the run and holds the port.
  const log = openSync(new URL("../.e2e-server.log", import.meta.url), "w");
  server = spawn("pnpm", ["exec", "vitepress", "preview", "docs", "--port", String(port)], { stdio: ["ignore", log, log], detached: true });
  // Ready means a content page answers, not only "/": the home page can be served before the rest of the build is.
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    try {
      const [a, b] = await Promise.all([fetch(`http://localhost:${port}/`), fetch(`http://localhost:${port}/getting-started/introduction`)]);
      ready = a.ok && b.ok;
    } catch {}
    if (!ready) await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) { console.error("the preview server did not become ready; see .e2e-server.log"); process.exit(1); }
}
let failed = 0;
for (const t of tasks) {
  if (!cmd[t]) { console.error(`unknown check: ${t} (${all.join(", ")})`); failed++; continue; }
  failed += spawnSync("node", cmd[t], { stdio: "inherit" }).status ? 1 : 0;
}
if (server) try { process.kill(-server.pid); } catch {}
process.exit(failed ? 1 : 0);

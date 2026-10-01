#!/usr/bin/env node
// Keeps track of the official Elixir docs this site is derived from.
//
//   node scripts/upstream.mjs                 check: fetch every source chapter, compare with upstream/
//   node scripts/upstream.mjs --diff <slug>   show what changed in one chapter
//   node scripts/upstream.mjs --update        accept the fetched chapters as the new snapshot
//   --from <dir>     read chapters from a local directory instead of the network (bootstrap, tests)
//   --date <d>       with --update, record this fetch date (YYYY-MM-DD) instead of today
//   --markdown       print the report as Markdown (used by CI to open an issue)
//   --json           print the report as JSON
//
// Exit codes: 0 in sync, 1 the official docs changed, 2 could not check (network errors).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const docs = join(root, "docs");
const snapDir = join(root, "upstream");
const snapFile = join(snapDir, "SNAPSHOT.json");
const BASE = process.env.UPSTREAM_BASE ?? "https://elixir.hexdocs.pm";

// our section directory -> the heading used in the official llms.txt index
const SECTIONS = {
  "getting-started": "Getting started",
  "mix-and-otp": "Mix & OTP",
  "meta-programming": "Meta-programming",
  "anti-patterns": "Anti-patterns",
  cheatsheets: "Cheatsheets",
  references: "References",
};

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const sha = (t) => createHash("sha256").update(t).digest("hex");

// every page we derive from an official chapter: docs/<section>/<slug>.md  <->  <BASE>/<slug>.md
const pages = [];
for (const dir of Object.keys(SECTIONS))
  for (const f of readdirSync(join(docs, dir)).filter((f) => f.endsWith(".md")).sort())
    pages.push({ dir, slug: basename(f, ".md") });

async function get(url) {
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.text();
      err = new Error(`${r.status} ${url}`);
      if (r.status === 404) break;
    } catch (e) {
      err = e;
    }
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  throw err;
}
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const from = opt("--from");
const fetchChapter = async (slug) => (from ? readFileSync(join(from, `${slug}.md`), "utf8") : get(`${BASE}/${slug}.md`));

// the official index, to spot chapters we have no page for (or pages whose chapter is gone)
function parseIndex(txt) {
  const sections = {};
  let cur;
  for (const line of txt.split("\n")) {
    const h = line.match(/^- (.+)$/);
    if (h) { cur = h[1].replace(/&amp;/g, "&").trim(); sections[cur] = []; continue; }
    const m = line.match(/^\s+- \[[^\]]*\]\(([^)]+)\.md\)/);
    if (m && cur) sections[cur].push(m[1]);
    else if (!line.trim()) cur = cur; // blank lines inside the index are harmless
  }
  return sections;
}

const results = await pool(pages, 6, async (p) => {
  try {
    const text = await fetchChapter(p.slug);
    const old = existsSync(join(snapDir, `${p.slug}.md`)) ? readFileSync(join(snapDir, `${p.slug}.md`), "utf8") : null;
    return { ...p, text, status: old === null ? "new" : sha(old) === sha(text) ? "same" : "changed" };
  } catch (e) {
    return { ...p, status: "error", error: String(e.message ?? e) };
  }
});

let index = null, indexError = null;
try { index = parseIndex(from && existsSync(join(from, "llms.txt")) ? readFileSync(join(from, "llms.txt"), "utf8") : await get(`${BASE}/llms.txt`)); } catch (e) { indexError = String(e.message ?? e); }
const added = [], gone = [];
if (index) {
  for (const [dir, title] of Object.entries(SECTIONS)) {
    const up = index[title] ?? [];
    const ours = pages.filter((p) => p.dir === dir).map((p) => p.slug);
    for (const s of up) if (!ours.includes(s)) added.push({ dir, slug: s });
    for (const s of ours) if (!up.includes(s)) gone.push({ dir, slug: s });
  }
}

// ---- --diff <slug>
if (flag("--diff")) {
  const slug = opt("--diff");
  const r = results.find((x) => x.slug === slug);
  if (!r || r.status === "error") { console.error(`cannot fetch ${slug}`); process.exit(2); }
  const tmp = mkdtempSync(join(tmpdir(), "upstream-"));
  writeFileSync(join(tmp, `${slug}.md`), r.text);
  try { execFileSync("git", ["diff", "--no-index", "--color=auto", join(snapDir, `${slug}.md`), join(tmp, `${slug}.md`)], { stdio: "inherit" }); } catch { /* git exits 1 when files differ */ }
  process.exit(0);
}

// ---- --update
if (flag("--update")) {
  const bad = results.filter((r) => r.status === "error");
  if (bad.length) { console.error(`refusing to update: ${bad.length} chapters could not be fetched`, bad.map((b) => b.slug)); process.exit(2); }
  mkdirSync(snapDir, { recursive: true });
  const files = {};
  for (const r of results) { writeFileSync(join(snapDir, `${r.slug}.md`), r.text); files[r.slug] = sha(r.text); }
  const compat = results.find((r) => r.slug === "compatibility-and-deprecations")?.text ?? "";
  const elixir = compat.match(/^(\d+\.\d+)\s*\|\s*Bug fixes and security patches/m)?.[1] ?? null;
  const snap = { date: opt("--date") ?? new Date().toISOString().slice(0, 10), elixir, source: BASE, files };
  writeFileSync(snapFile, JSON.stringify(snap, null, 2) + "\n");
  const changed = results.filter((r) => r.status !== "same").length;
  console.log(`snapshot written: ${results.length} chapters (${changed} new or changed), Elixir ${elixir}, ${snap.date}`);
  if (added.length || gone.length) console.log("note: the official chapter list also changed:", { added, gone });
  process.exit(0);
}

// ---- check
const changed = results.filter((r) => r.status === "changed" || r.status === "new");
const errors = results.filter((r) => r.status === "error");
const snap = existsSync(snapFile) ? JSON.parse(readFileSync(snapFile, "utf8")) : null;
const stat = (r) => {
  const a = readFileSync(join(snapDir, `${r.slug}.md`), "utf8").split("\n"), b = r.text.split("\n");
  const sa = new Set(a), sb = new Set(b);
  return `+${b.filter((l) => !sa.has(l)).length} −${a.filter((l) => !sb.has(l)).length}`;
};
const drift = changed.length > 0 || added.length > 0 || gone.length > 0;
const report = {
  snapshot: snap ? { date: snap.date, elixir: snap.elixir } : null,
  checked: results.length,
  changed: changed.map((r) => ({ section: r.dir, slug: r.slug, lines: r.status === "new" ? "new" : stat(r) })),
  newChapters: added,
  removedChapters: gone,
  errors: errors.map((r) => ({ slug: r.slug, error: r.error })).concat(indexError ? [{ slug: "llms.txt", error: indexError }] : []),
};

if (flag("--json")) console.log(JSON.stringify(report, null, 2));
else if (flag("--markdown")) {
  const L = [`The official Elixir docs changed since the snapshot of ${report.snapshot?.date ?? "?"} (Elixir ${report.snapshot?.elixir ?? "?"}).`, ""];
  if (report.changed.length) { L.push(`### Changed chapters (${report.changed.length})`, "", ...report.changed.map((c) => `- [\`${c.slug}\`](${BASE}/${c.slug}.html) (${c.section}): ${c.lines} lines`), ""); }
  if (report.newChapters.length) L.push("### New chapters with no page here", "", ...report.newChapters.map((c) => `- \`${c.slug}\` in ${c.dir}`), "");
  if (report.removedChapters.length) L.push("### Pages whose chapter is gone upstream", "", ...report.removedChapters.map((c) => `- \`${c.dir}/${c.slug}\``), "");
  if (report.errors.length) L.push("### Could not fetch", "", ...report.errors.map((e) => `- \`${e.slug}\`: ${e.error}`), "");
  L.push("Review with `pnpm upstream:diff <slug>`, update the page, then accept with `pnpm upstream:update`.");
  console.log(L.join("\n"));
} else {
  console.log(`snapshot: ${report.snapshot ? `${report.snapshot.date}, Elixir ${report.snapshot.elixir}` : "none yet (run with --update)"}`);
  console.log(`checked ${results.length} chapters: ${results.length - changed.length - errors.length} unchanged, ${changed.length} changed, ${errors.length} errors`);
  for (const c of report.changed) console.log(`  changed  ${c.section}/${c.slug}  ${c.lines}`);
  for (const c of added) console.log(`  new upstream chapter, no page here: ${c.dir}/${c.slug}`);
  for (const c of gone) console.log(`  page whose chapter is gone upstream: ${c.dir}/${c.slug}`);
  for (const e of report.errors) console.log(`  error    ${e.slug}: ${e.error}`);
  if (!drift && !errors.length) console.log("in sync with the official docs");
  else if (drift) console.log("\nreview:  pnpm upstream:diff <slug>     accept:  pnpm upstream:update");
}
process.exit(drift ? 1 : errors.length ? 2 : 0);

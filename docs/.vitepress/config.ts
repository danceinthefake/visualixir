import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";

const base = process.env.DOCS_BASE ?? "/";
// Origin the site is served from, e.g. https://visualixir.example.com (no trailing slash).
// Social previews and the sitemap need absolute URLs, so they only appear when this is set.
const site = process.env.SITE_URL?.replace(/\/$/, "");
const title = "Visualixir";
const tagline = "The official Elixir docs, explained with diagrams.";
const sections: Record<string, string> = {
  "getting-started": "Getting started",
  "mix-and-otp": "Mix & OTP",
  "meta-programming": "Meta-programming",
  "anti-patterns": "Anti-patterns",
  cheatsheets: "Cheatsheets",
  references: "References",
};

// When the official chapters were last taken (upstream/SNAPSHOT.json, written by scripts/upstream.mjs).
const snapFile = fileURLToPath(new URL("../../upstream/SNAPSHOT.json", import.meta.url));
const snapshot: { date: string; elixir?: string } | undefined = existsSync(snapFile)
  ? JSON.parse(readFileSync(snapFile, "utf8"))
  : undefined;
const snapshotText = snapshot ? `snapshot of ${snapshot.date}${snapshot.elixir ? `, Elixir ${snapshot.elixir}` : ""}` : "";

// Counts shown on the home page, computed so they can't go stale.
const docsDir = fileURLToPath(new URL("..", import.meta.url));
const pageCount = Object.keys(sections).reduce(
  (n, dir) => n + readdirSync(join(docsDir, dir)).filter((f) => f.endsWith(".md")).length,
  0,
);
const diagramCount = (function count(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce(
    (n, e) => n + (e.isDirectory() ? count(join(dir, e.name)) : e.name.endsWith(".svg") ? 1 : 0),
    0,
  );
})(join(docsDir, "diagrams"));

export default defineConfig({
  title,
  description: `Elixir, drawn. ${tagline}`,
  lang: "en",
  base,
  cleanUrls: true,
  sitemap: site ? { hostname: site + base } : undefined,
  // One description per page: VitePress emits <meta name="description"> from pageData.description.
  transformPageData(pageData) {
    if (pageData.relativePath === "index.md" && pageData.frontmatter.hero) {
      pageData.frontmatter.hero.tagline = `${tagline} ${pageCount} pages, ${diagramCount} diagrams, in the official order.`;
    }
    const section = sections[pageData.relativePath.split("/")[0]];
    if (pageData.frontmatter.description || !section) return;
    pageData.description = `${pageData.title} (${section}): the official Elixir docs, explained with diagrams.`;
  },
  transformHead({ pageData }) {
    const home = pageData.relativePath === "index.md";
    const pageTitle = home ? `${title}: Elixir, drawn` : `${pageData.title} | ${title}`;
    const description = pageData.description || tagline;
    const url = site ? `${site}${base}${pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "")}` : undefined;
    const image = site ? `${site}${base}og.png` : undefined;
    const meta = (k: string, name: string, content: string): [string, Record<string, string>] => [
      "meta",
      { [k]: name, content },
    ];
    return [
      meta("property", "og:type", home ? "website" : "article"),
      meta("property", "og:site_name", title),
      meta("property", "og:title", pageTitle),
      meta("property", "og:description", description),
      meta("name", "twitter:card", image ? "summary_large_image" : "summary"),
      meta("name", "twitter:title", pageTitle),
      meta("name", "twitter:description", description),
      ...(url ? [meta("property", "og:url", url), ["link", { rel: "canonical", href: url }] as [string, Record<string, string>]] : []),
      ...(image
        ? [
            meta("property", "og:image", image),
            meta("property", "og:image:width", "1200"),
            meta("property", "og:image:height", "630"),
            meta("name", "twitter:image", image),
          ]
        : []),
    ];
  },
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${base}favicon.svg` }],
    ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: `${base}favicon-32.png` }],
    ["link", { rel: "apple-touch-icon", href: `${base}apple-touch-icon.png` }],
    ["meta", { name: "theme-color", content: "#17181a" }],
    // Mirror VitePress's saved appearance onto data-theme before first paint, so Bless tokens
    // (and the diagrams painted from them) don't flash the OS theme.
    [
      "script",
      {},
      `try{var a=localStorage.getItem("vitepress-theme-appearance");if(a==="dark"||a==="light")document.documentElement.dataset.theme=a}catch(e){}`,
    ],
  ],
  // Higher-contrast code themes: the default github themes miss 4.5:1 on comments and keywords.
  markdown: { theme: { light: "github-light-high-contrast", dark: "github-dark-high-contrast" } },
  vite: { ssr: { noExternal: ["blessing-ui"] } },
  themeConfig: {
    nav: [
      { text: "Getting started", link: "/getting-started/introduction" },
      { text: "Mix & OTP", link: "/mix-and-otp/introduction-to-mix" },
      { text: "Meta-programming", link: "/meta-programming/quote-and-unquote" },
      { text: "Anti-patterns", link: "/anti-patterns/what-anti-patterns" },
      { text: "Cheatsheets", link: "/cheatsheets/enum-cheat" },
      { text: "References", link: "/references/compatibility-and-deprecations" },
    ],
    sidebar: {
      "/getting-started/": [
        {
          text: "Getting started",
          items: [
            { text: "Introduction", link: "/getting-started/introduction" },
            { text: "Basic types", link: "/getting-started/basic-types" },
            { text: "Lists and tuples", link: "/getting-started/lists-and-tuples" },
            { text: "Pattern matching", link: "/getting-started/pattern-matching" },
            { text: "case, cond, and if", link: "/getting-started/case-cond-and-if" },
            { text: "Anonymous functions", link: "/getting-started/anonymous-functions" },
            { text: "Binaries, strings, and charlists", link: "/getting-started/binaries-strings-and-charlists" },
            { text: "Keyword lists and maps", link: "/getting-started/keywords-and-maps" },
            { text: "Modules and functions", link: "/getting-started/modules-and-functions" },
            { text: "alias, require, import, and use", link: "/getting-started/alias-require-and-import" },
            { text: "Module attributes", link: "/getting-started/module-attributes" },
            { text: "Structs", link: "/getting-started/structs" },
            { text: "Recursion", link: "/getting-started/recursion" },
            { text: "Enumerables and Streams", link: "/getting-started/enumerable-and-streams" },
            { text: "Comprehensions", link: "/getting-started/comprehensions" },
            { text: "Protocols", link: "/getting-started/protocols" },
            { text: "Sigils", link: "/getting-started/sigils" },
            { text: "try, catch, and rescue", link: "/getting-started/try-catch-and-rescue" },
            { text: "Processes", link: "/getting-started/processes" },
            { text: "IO and the file system", link: "/getting-started/io-and-the-file-system" },
            { text: "Writing documentation", link: "/getting-started/writing-documentation" },
            { text: "Optional syntax sheet", link: "/getting-started/optional-syntax" },
            { text: "Erlang libraries", link: "/getting-started/erlang-libraries" },
            { text: "Debugging", link: "/getting-started/debugging" },
          ],
        },
      ],
      "/references/": [
        {
          text: "References",
          items: [
            { text: "Compatibility and deprecations", link: "/references/compatibility-and-deprecations" },
            { text: "Gradual set-theoretic types", link: "/references/gradual-set-theoretic-types" },
            { text: "Library guidelines", link: "/references/library-guidelines" },
            { text: "Naming conventions", link: "/references/naming-conventions" },
            { text: "Operators reference", link: "/references/operators" },
            { text: "Patterns and guards", link: "/references/patterns-and-guards" },
            { text: "Syntax reference", link: "/references/syntax-reference" },
            { text: "Software Bill of Materials", link: "/references/sbom" },
            { text: "Typespecs reference", link: "/references/typespecs" },
            { text: "Unicode syntax", link: "/references/unicode-syntax" },
          ],
        },
      ],
      "/cheatsheets/": [
        {
          text: "Cheatsheets",
          items: [
            { text: "Enum cheatsheet", link: "/cheatsheets/enum-cheat" },
            { text: "Set-theoretic types cheatsheet", link: "/cheatsheets/types-cheat" },
          ],
        },
      ],
      "/anti-patterns/": [
        {
          text: "Anti-patterns",
          items: [
            { text: "What are anti-patterns?", link: "/anti-patterns/what-anti-patterns" },
            { text: "Code-related", link: "/anti-patterns/code-anti-patterns" },
            { text: "Design-related", link: "/anti-patterns/design-anti-patterns" },
            { text: "Process-related", link: "/anti-patterns/process-anti-patterns" },
            { text: "Meta-programming", link: "/anti-patterns/macro-anti-patterns" },
          ],
        },
      ],
      "/meta-programming/": [
        {
          text: "Meta-programming",
          items: [
            { text: "Quote and unquote", link: "/meta-programming/quote-and-unquote" },
            { text: "Macros", link: "/meta-programming/macros" },
            { text: "Domain-Specific Languages", link: "/meta-programming/domain-specific-languages" },
          ],
        },
      ],
      "/mix-and-otp/": [
        {
          text: "Mix & OTP",
          items: [
            { text: "Introduction to Mix", link: "/mix-and-otp/introduction-to-mix" },
            { text: "Simple state with agents", link: "/mix-and-otp/agents" },
            { text: "Registries and supervision trees", link: "/mix-and-otp/supervisor-and-application" },
            { text: "Supervising dynamic children", link: "/mix-and-otp/dynamic-supervisor" },
            { text: "Task and gen_tcp", link: "/mix-and-otp/task-and-gen-tcp" },
            { text: "Doctests, patterns, and with", link: "/mix-and-otp/docs-tests-and-with" },
            { text: "Configuration and distribution", link: "/mix-and-otp/config-and-distribution" },
            { text: "Client-server with GenServer", link: "/mix-and-otp/genservers" },
            { text: "Releases", link: "/mix-and-otp/releases" },
          ],
        },
      ],
    },
    snapshot,
    footer: {
      message: `Site code: MIT. Pages and diagrams are derived from the Elixir documentation (Apache-2.0${snapshotText ? ", " + snapshotText : ""}). Not affiliated with the Elixir Team.`,
      copyright: "Copyright © 2026 DanceInTheFake",
    },
    search: { provider: "local" },
    outline: [2, 3],
  },
});

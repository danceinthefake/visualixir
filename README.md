# Visualixir

Elixir, drawn. Pages mirror the [official Elixir docs](https://elixir.hexdocs.pm/), each explained
with Graphviz diagrams. Site: VitePress + [Blessing UI](https://www.npmjs.com/package/blessing-ui).

## Develop

```sh
mise install          # node 24 (graphviz `dot` from your system package manager)
pnpm install
pnpm run dev           # builds diagrams, then serves docs
pnpm run build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most useful report is a page that disagrees with the official chapter.

## Layout

```
docs/                          VitePress root
  getting-started/*.md         one page per official chapter
  mix-and-otp/*.md             the Mix & OTP guide
  meta-programming/*.md        the Meta-programming guide
  anti-patterns/*.md           the Anti-patterns guide
  cheatsheets/*.md             cheatsheets
  references/*.md              reference pages
  diagrams/<page>/<name>.dot   Graphviz source; make renders the .svg beside it
  .vitepress/theme/            Diagram.vue inlines SVG, diagram.css repaints it from --bless-* tokens
Makefile                       .dot -> .svg, shared defaults live in DOT_FLAGS
```

## Build settings

| Variable | Default | Effect |
|---|---|---|
| `DOCS_BASE` | `/` | URL prefix, when the site is served from a sub-path |
| `SITE_URL` | unset | Origin such as `https://visualixir.example.com`. When set, pages get `og:url`, a canonical link, `og:image` / `twitter:image` (absolute URLs, required by social crawlers) and a `sitemap.xml`. Without it those tags are left out. |

Production is at https://visualixir.blessing.id (Cloudflare Pages, deployed by `.github/workflows/ci.yml`; set the repo variable `SITE_URL` to that origin). `docs/public/robots.txt` names the sitemap at that domain, so update it if the domain changes.

Icons and the social image are in `docs/public/` (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `og.png`). The mark is a small tree diagram in Blessing UI's colours. `og.png` has the page and diagram counts baked in.

## Checks and tooling

| Command | What it does |
|---|---|
| `pnpm e2e` | serves the built site and runs [the browser checks](e2e/README.md): every page, phone layout, search, axe (light/dark, desktop/phone) |
| `pnpm e2e:live` | the same kind of checks against https://visualixir.blessing.id, plus redirects, headers and HTTPS |
| `pnpm audit:pages` | checks every page and diagram against the official chapters in `upstream/`: function names, strings, results, numbers (`--dropped` also lists what a page left out) |
| `pnpm upstream:check` | have the official docs changed since the snapshot? (see below) |
| `pnpm assets` | re-render `og.png` and the icons from `favicon.svg` and `scripts/og.html` |

CI runs the audit and the build on every push, then the e2e checks (three jobs in parallel), and deploys only if they pass. Set `CHROMIUM=/usr/bin/chromium` to use a system browser locally instead of Playwright's download.

## "Under the hood" sections

Some pages end a section with a collapsed **Under the hood** panel: what the construct does in memory, on the CPU or on storage, down to the kernel and the hardware. It is our own explanation, not derived from the official chapters, and says so in its title. Every claim is cited to the Erlang/OTP docs or a man page, or measured (Elixir 1.20 / OTP 29, 64-bit Linux). The rules for writing one are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Keeping up with the official docs

The pages mirror the official Elixir docs as of a **snapshot** (date and Elixir version in `upstream/SNAPSHOT.json`, shown under every page and in the footer). `upstream/` holds the official chapters as they were when each page was written.

```sh
pnpm upstream:check            # fetch every chapter and compare with the snapshot (exit 1: changed, 2: could not check)
pnpm upstream:diff <slug>      # what changed in one chapter
pnpm upstream:update           # accept the fetched chapters as the new snapshot, after you have updated the pages
```

It also reports chapters that appeared in the official index with no page here, and pages whose chapter is gone. A weekly workflow (`.github/workflows/upstream.yml`) runs the check and opens an issue when something changed.

## Deploying

CI (`.github/workflows/ci.yml`) builds on every push and pull request. Its `deploy` job is off by default. To deploy by hand:

```sh
pnpm run build:site     # add SITE_URL=https://visualixir.blessing.id for canonical links, social tags and the sitemap
npx wrangler@4 pages deploy docs/.vitepress/dist --project-name visualixir --branch main
```

To let CI deploy on pushes to `main`, set the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets and the repo variable `DEPLOY_CLOUDFLARE=true`.

## Accessibility

Checked with axe-core on every page at 1200px and 390px, in light and dark: no violations. Also checked by hand: keyboard tab order and skip link, focus outlines, landmarks, and reflow at 320px.

- Each diagram is one image (`role="img"`) named by its caption. Its labels, in drawing order, are its description (`aria-describedby`). Graphviz's per-node `<title>` elements, XML prolog and DOCTYPE are stripped from the inline SVG.
- On phones a wide diagram scrolls sideways and becomes keyboard-focusable only while it overflows.
- Code uses the GitHub high-contrast Shiki themes, and `docs/.vitepress/theme/custom.css` fixes the remaining default-theme contrast misses.
- The home page gets a `main` landmark set at runtime, since the home layout has none.

## Adding a diagram

1. Write `docs/diagrams/<page>/<name>.dot` (a full `digraph`). Put `class=hl` on what the reader should look at.
2. `make`, then `<Diagram name="<page>/<name>" caption="..." />` in the page.
3. Don't set colours you care about in the `.dot`: `diagram.css` overrides them for light/dark.
4. Record nodes: give ports names that aren't compass points (`n`, `e`, `s`, `w`, `c`).

## Roadmap

Mirrors the official sections, in official order. Chapter sources: `https://elixir.hexdocs.pm/<slug>.md`, index at `llms.txt`.

- [x] Scaffold (VitePress, Blessing UI, Graphviz pipeline, light/dark diagrams)
- [x] Getting started (all 24 chapters): Introduction, Basic types, Lists and tuples, Pattern matching,
  case/cond/if, Anonymous functions, Binaries/strings/charlists, Keyword lists and maps, Modules and functions,
  alias/require/import/use, Module attributes, Structs, Recursion, Enumerables and Streams, Comprehensions, Protocols,
  Sigils, try/catch/rescue, Processes, IO and the file system, Writing documentation, Optional syntax, Erlang libraries, Debugging
- [x] Cheatsheet: Enum (every function)
- [x] Cheatsheet: set-theoretic types
- [x] Mix & OTP (all 9 chapters): Introduction to Mix, Agents, Registries and supervision trees, Supervising dynamic children,
  Task and gen_tcp, Doctests/patterns/with, Configuration and distribution, Client-server with GenServer, Releases
- [x] Meta-programming (Quote and unquote, Macros, Domain-Specific Languages)
- [x] Anti-patterns (intro + code, design, process, meta-programming: 25 patterns)
- [x] References (all 10: compatibility, gradual types, library guidelines, naming conventions, operators, patterns and guards, syntax, SBoM, typespecs, Unicode syntax)

## License

Two licences, by path (details in [NOTICE](NOTICE) and [REUSE.toml](REUSE.toml)):

| What | License |
|---|---|
| Site code: Makefile, tool config, `docs/.vitepress`, `docs/index.md`, this README | [MIT](LICENSE) |
| Pages and diagrams (`docs/*/` and `docs/diagrams`), derived from the Elixir documentation | [Apache-2.0](LICENSES/Apache-2.0.txt) |

The content is derived from the Elixir documentation, © Plataformatec and The Elixir Team, licensed under Apache-2.0. It is condensed, restructured and illustrated with diagrams, so the original is authoritative. Every page links to the chapter it comes from. This project is not affiliated with the Elixir Team.

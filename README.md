# Visualixir

Elixir, drawn. The pages mirror the [official Elixir docs](https://elixir.hexdocs.pm/). Graphviz diagrams explain each page. The site uses VitePress and [Blessing UI](https://www.npmjs.com/package/blessing-ui).

## Develop

```sh
mise install          # node 24 (get graphviz `dot` from your system package manager)
pnpm install
pnpm run dev           # builds diagrams, then serves docs
pnpm run build
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). The most useful report is a page that disagrees with the official chapter. All prose in this repository follows ASD-STE100. The rules are in CONTRIBUTING.md.

## Layout

```
docs/                          VitePress root
  getting-started/*.md         one page per official chapter
  mix-and-otp/*.md             the Mix & OTP guide
  meta-programming/*.md        the Meta-programming guide
  anti-patterns/*.md           the Anti-patterns guide
  cheatsheets/*.md             cheatsheets
  references/*.md              reference pages
  modules/*.md                 one page per module (Task, Registry, ExUnit, Supervisor, Process, IEx)
  diagrams/<page>/<name>.dot   Graphviz source. make renders the .svg beside it
  .vitepress/theme/            Diagram.vue inlines SVG, diagram.css repaints it from --bless-* tokens
Makefile                       .dot -> .svg, shared defaults live in DOT_FLAGS
```

## Build settings

| Variable | Default | Effect |
|---|---|---|
| `DOCS_BASE` | `/` | URL prefix, when the site is served from a sub-path |
| `SITE_URL` | unset | Origin such as `https://visualixir.example.com`. When set, pages get `og:url`, a canonical link, `og:image` / `twitter:image` (absolute URLs, required by social crawlers) and a `sitemap.xml`. Without it those tags are left out. |

Production is at https://visualixir.blessing.id (Cloudflare Pages). The workflow `.github/workflows/ci.yml` deploys it. Set the repository variable `SITE_URL` to that origin. The file `docs/public/robots.txt` names the sitemap at that domain. If the domain changes, update the file.

The icons and the social image are in `docs/public/` (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `og.png`). The mark is a small tree diagram in the colors of Blessing UI. The file `og.png` has no page or diagram counts.

## Checks and tooling

| Command | What it does |
|---|---|
| `pnpm e2e` | serves the built site and runs [the browser checks](e2e/README.md): every page, phone layout, search, and axe (light and dark, desktop and phone) |
| `pnpm e2e:live` | the same kind of checks against https://visualixir.blessing.id, plus redirects, headers, and HTTPS |
| `pnpm audit:pages` | compares every page and diagram with the official chapters in `upstream/`: function names, strings, results, and numbers (`--dropped` also lists what a page omits) |
| `pnpm upstream:check` | finds changes in the official docs since the snapshot (see below) |
| `pnpm assets` | renders `og.png` and the icons again from `favicon.svg` and `scripts/og.html` |

On every push, CI runs the audit and the build. Then it runs the e2e checks in three parallel jobs. CI deploys only if all checks pass. To use a system browser locally instead of the Playwright download, set `CHROMIUM=/usr/bin/chromium`.

## Reader aids

Every diagram opens in an **Enlarge** dialog with zoom. A diagram that shows a sequence can run one arrow at a time.

The first mention of a term on a page has a dotted underline. To see a short definition from the official docs, hover over the term, focus it, or tap it. The [glossary](docs/glossary.md) lists all terms (`docs/.vitepress/glossary.json`).

Each page shows what to **read first** and which pages are **related** (`docs/.vitepress/related.json`). A **Mark as read** button at the end of each page feeds the reading **paths** (`docs/.vitepress/paths.json`). The browser keeps the progress. The site does not store it.

Key pages end with **Check yourself** questions. The answers come from the official docs (`docs/.vitepress/quiz.json`). A page with several "Under the hood" sections has Open all, Close all, and an "always open" choice. The browser remembers the choice.

## "Under the hood" sections

Some pages end a section with a collapsed **Under the hood** panel. The panel explains what the construct does in memory, on the CPU, or on storage, down to the kernel and the hardware. It is our own explanation. It does not come from the official chapters, and its title says so. Each claim is cited to the Erlang/OTP docs or a man page, or we measured it (Elixir 1.20 and OTP 29, 64-bit Linux). The rules for these sections are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Keeping up with the official docs

The pages mirror the official Elixir docs as of a **snapshot**. The date and the Elixir version are in `upstream/SNAPSHOT.json`. The site shows them under every page and in the footer. The directory `upstream/` holds the official chapters as they were when each page was written.

```sh
pnpm upstream:check            # fetch every chapter and compare with the snapshot (exit 1: changed, 2: could not check)
pnpm upstream:diff <slug>      # what changed in one chapter
pnpm upstream:update           # accept the fetched chapters as the new snapshot, after you update the pages
```

Pages under `docs/modules/` follow the **module documentation** (Task, Registry, ExUnit, Supervisor, Process, IEx). The guide index does not list it. The sources are in `MODULES` in `scripts/upstream.mjs`. The file `upstream/<slug>.md` holds those sources, joined in order. A new module page needs an entry there.

The check also reports chapters that are in the official index but have no page here. It also reports pages whose chapter is gone. A weekly workflow (`.github/workflows/upstream.yml`) runs the check. If something changed, the workflow opens an issue.

## Deploying

CI (`.github/workflows/ci.yml`) builds on every push and pull request. Its `deploy` job is off by default. To deploy by hand, run these commands:

```sh
pnpm run build:site     # add SITE_URL=https://visualixir.blessing.id for canonical links, social tags, and the sitemap
npx wrangler@4 pages deploy docs/.vitepress/dist --project-name visualixir --branch main
```

To let CI deploy on pushes to `main`, set the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Then set the repository variable `DEPLOY_CLOUDFLARE=true`.

## Accessibility

Axe-core finds no violations on every page at 1200px and 390px, in light and dark. We also checked these items by hand: the keyboard tab order, the skip link, the focus outlines, the landmarks, and the reflow at 320px.

- Each diagram is one image (`role="img"`) that its caption names. The labels of the diagram, in drawing order, are its description (`aria-describedby`). The build removes the per-node `<title>` elements, the XML prolog, and the DOCTYPE of Graphviz from the inline SVG.
- On phones, a wide diagram scrolls sideways. It can receive keyboard focus only while it overflows.
- Code uses the GitHub high-contrast Shiki themes. The file `docs/.vitepress/theme/custom.css` fixes the remaining contrast failures of the default theme.
- The home layout has no `main` landmark. The home page sets one at runtime.

## Adding a diagram

1. Write `docs/diagrams/<page>/<name>.dot` (a full `digraph`). Put `class=hl` on what the reader must look at.
2. Run `make`. Then add `<Diagram name="<page>/<name>" caption="..." />` to the page.
3. Do not set colors in the `.dot` file. The file `diagram.css` replaces them for light and dark.
4. In record nodes, do not give ports the names of compass points (`n`, `e`, `s`, `w`, `c`).

## Roadmap

The roadmap follows the official sections, in the official order. The chapter sources are at `https://elixir.hexdocs.pm/<slug>.md`. The index is at `llms.txt`.

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

The license depends on the path (see [NOTICE](NOTICE) and [REUSE.toml](REUSE.toml)):

| What | License |
|---|---|
| Site code: Makefile, tool configuration, `docs/.vitepress`, `docs/index.md`, this README | [MIT](LICENSE) |
| Pages and diagrams (`docs/*/` and `docs/diagrams`), from the Elixir documentation | [Apache-2.0](LICENSES/Apache-2.0.txt) |

The content comes from the Elixir documentation, © Plataformatec and The Elixir Team, under Apache-2.0. We condensed and restructured it and added diagrams, so the original is the reference. Every page links to the chapter that it comes from. This project is not affiliated with the Elixir Team.

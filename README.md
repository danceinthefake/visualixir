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

## Layout

```
docs/                          VitePress root
  getting-started/*.md         one page per official chapter
  mix-and-otp/*.md             the Mix & OTP guide
  meta-programming/*.md        the Meta-programming guide
  anti-patterns/*.md           the Anti-patterns guide
  cheatsheets/*.md             cheatsheets
  diagrams/<page>/<name>.dot   Graphviz source; make renders the .svg beside it
  .vitepress/theme/            Diagram.vue inlines SVG, diagram.css repaints it from --bless-* tokens
Makefile                       .dot -> .svg, shared defaults live in DOT_FLAGS
```

## Adding a diagram

1. Write `docs/diagrams/<page>/<name>.dot` (a full `digraph`). Put `class=hl` on what the reader should look at.
2. `make`, then `<Diagram name="<page>/<name>" caption="..." />` in the page.
3. Don't set colours you care about in the `.dot`: `diagram.css` overrides them for light/dark.
4. Record nodes: give ports names that aren't compass points (`n`, `e`, `s`, `w`, `c`).

## Roadmap

Mirrors the official sections, in official order. Chapter sources: `https://elixir.hexdocs.pm/<slug>.md`, index at `llms.txt`.

- [x] Scaffold (VitePress, Blessing UI, Graphviz pipeline, light/dark diagrams)
- [x] Getting started (all 24 chapters, 68 diagrams): Introduction, Basic types, Lists and tuples, Pattern matching,
  case/cond/if, Anonymous functions, Binaries/strings/charlists, Keyword lists and maps, Modules and functions,
  alias/require/import/use, Module attributes, Structs, Recursion, Enumerables and Streams, Comprehensions, Protocols,
  Sigils, try/catch/rescue, Processes, IO and the file system, Writing documentation, Optional syntax, Erlang libraries, Debugging
- [x] Cheatsheet: Enum (every function, 10 diagrams)
- [ ] Cheatsheet: set-theoretic types
- [x] Mix & OTP (all 9 chapters, 30 diagrams): Introduction to Mix, Agents, Registries and supervision trees, Supervising dynamic children,
  Task and gen_tcp, Doctests/patterns/with, Configuration and distribution, Client-server with GenServer, Releases
- [x] Meta-programming (Quote and unquote, Macros, Domain-Specific Languages; 13 diagrams)
- [x] Anti-patterns (intro + code, design, process, meta-programming: 25 patterns, 21 diagrams)
- [ ] References (patterns and guards, typespecs, compatibility, naming conventions, and more)

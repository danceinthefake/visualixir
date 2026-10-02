# Contributing

Visualixir explains the official Elixir docs with diagrams. The most useful contribution is
**a report that something is wrong**: a page that says something the official chapter doesn't, leaves
out something it should keep, or a diagram that misleads. Open an issue using the *Inaccuracy* form.

Questions about Elixir itself belong in the [Elixir forum](https://elixirforum.com), not here.

## Ground rules

- **The official chapter is the source of truth.** Pages follow `upstream/<slug>.md` (a snapshot of
  the official chapters). Don't add claims that aren't in it. Link back to the official chapter on every page.
- **English only.**
- **Don't hardcode counts** of pages or diagrams. The home page computes them.
- Diagrams explain, they don't decorate. If a sentence says it better, skip the diagram.

## Setup

[mise](https://mise.jdx.dev) installs Node and pnpm from `mise.toml`. You also need
[Graphviz](https://graphviz.org) (`dot`) to rebuild diagrams.

```sh
mise install
pnpm install
pnpm dev        # http://localhost:5173
```

## Changing a page

Pages are Markdown in `docs/<section>/`. Run the audit before you commit. It checks every function name,
string, result and number in code against the official chapters:

```sh
pnpm audit:pages
```

An unavoidable false positive goes in `scripts/audit-allow.json`, after you've checked it against the chapter.

## Changing or adding a diagram

1. Edit or add `docs/diagrams/<page>/<name>.dot`.
2. Run `make` (needs `dot`). The `.svg` files are generated **and committed**.
3. Reference it in the page: `<Diagram name="<page>/<name>" caption="..." />`.

Colours come from `docs/.vitepress/theme/diagram.css`, not from the `.dot` file. Use the classes
`hl`, `bad` and `dim`. Keep text readable on a phone: wide left-to-right diagrams shrink, so prefer
top-to-bottom. Graphviz stacks sibling clusters in reverse declaration order, so declare the one you want
first (the problem) *last* in a left-to-right layout. Look at the rendered result.

## Before you open a pull request

```sh
pnpm audit:pages
pnpm run build:site
pnpm e2e          # every page, phone layout, search, and axe (light/dark, desktop/phone)
```

CI runs the same checks and blocks the deploy if one fails. Run `pnpm assets` only if you change
`favicon.svg` or `scripts/og.html`.

Keep a pull request to one thing. Describe the change from the reader's side first (what they'll see
differently), then the mechanics.

## When the official docs change

A weekly workflow opens an `upstream-drift` issue when the official chapters change. To handle it:
`pnpm upstream:diff <slug>`, update the page, then `pnpm upstream:update`.

## Licensing

Site code is MIT. Pages and diagrams derived from the Elixir documentation are Apache-2.0
(see `NOTICE` and `REUSE.toml`). By contributing you agree your change is licensed under the terms that
apply to the files it touches. A new content section under `docs/<section>/` must be added to the
content globs in `REUSE.toml`.

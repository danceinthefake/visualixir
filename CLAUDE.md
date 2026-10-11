# visualixir

Visualixir is a VitePress site of Graphviz diagrams that explain the official Elixir docs. See README.md.

# Writing standard

The reference for all prose is ASD-STE100 (Simplified Technical English), Issue 9. The rules are in the global `~/.claude/CLAUDE.md`. The `simple-english` plugin implements them. Use its Strict mode for documents.

- The rules apply to every prose file in this repository. These are CLAUDE.md, README.md, CONTRIBUTING.md, `e2e/README.md`, and the files in `.github/`. They also apply to the text of the `docs/` pages and the reader text in the JSON files of `docs/.vitepress/`. Last, they apply to commit messages, pull request descriptions, and code comments.
- All pages, the JSON files with reader text (`glossary.json`, `quiz.json`, `paths.json`), and the project documents are in STE. Write all new and changed prose in STE.
- The interface text in the Vue components and the labels in the `.dot` diagrams follow the standard. Diagram labels are short fragments, so only the word and punctuation rules apply to them.
- Do not change code, identifiers, commands, file paths, quoted errors, product names, or text that quotes the official Elixir docs.
- Before you commit prose, search it for contractions, `should`, `may`, `might`, `could`, `would`, semicolons, and em-dashes.
- No tool can guarantee compliance. The official dictionary is free at asd-ste100.org.

# Rules for this repository

- Use pnpm as the package manager. Use mise for tool versions (`mise.toml`).
- Diagram sources are `.dot` files in `docs/diagrams/`. The command `make` generates the `.svg` files. Commit them.
- Colors come from `docs/.vitepress/theme/diagram.css`, not from the `.dot` files.
- Put scratch scripts and screenshots in `/home/hafidz/danceinthefake/tmp/visualixir/`. Put reusable files in the repository: `e2e/` (browser checks, `pnpm e2e`) and `scripts/` (audit, upstream check, og and icon generator).
- Write in English only. Link back to the official chapter on every page.
- When a roadmap item is finished, mark it done in README.md.
- The license depends on the path. See NOTICE, REUSE.toml, LICENSE, and LICENSES/. Site code is MIT. Pages and diagrams that come from the Elixir docs are Apache-2.0.
- When you add a content section in `docs/<section>/`, add it to the content globs in REUSE.toml. If a page comes from a chapter whose source header names Plataformatec (or 2025), add it to the matching annotation.
- Do not hardcode page or diagram counts. The home tagline computes them at build time (docs/.vitepress/config.ts). The file og.png has no counts on purpose.
- Before you commit a page or diagram change, run `pnpm audit:pages`.
- Before you push a site change, run `pnpm run build:site`, then `pnpm e2e`. CI runs both. If one fails, CI blocks the deploy.
- An "Under the hood" section (`<UnderTheHood>`) is our own text. It does not come from the official chapters. Cite each claim to the Erlang/OTP docs or a man page, or measure it and state the platform. Name each diagram `uth-<name>.dot`. The audit skips these sections, so review them by hand. If you cannot support a story, skip the section. See CONTRIBUTING.md.

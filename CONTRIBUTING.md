# Contributing

Visualixir explains the official Elixir docs with diagrams. The most useful contribution is a report that something is wrong. For example, a page can say something that the official chapter does not say. A page can omit something that the chapter says. A diagram can mislead. Open an issue with the *Inaccuracy* form.

Questions about Elixir itself belong in the [Elixir forum](https://elixirforum.com).

## Ground rules

- The official chapter is the source of truth. Pages follow `upstream/<slug>.md`, a snapshot of the official chapters. For pages under `docs/modules/`, the snapshot holds the module docs.
- Do not add a claim that the snapshot does not contain.
- Link back to the official chapter on every page.
- Write in English only.
- Do not hardcode counts of pages or diagrams. The home page computes them.
- A diagram must explain. If a sentence explains better, do not add the diagram.

## Writing standard

All prose follows ASD-STE100 (Simplified Technical English), Issue 9. This applies to pages, README files, commit messages, pull request descriptions, and code comments. The main rules:

- In procedures, use the imperative mood. Write one instruction per sentence and 20 words at most.
- In descriptions, use simple tenses and the active voice. Write 25 words at most per sentence.
- Put the condition before the command: "If the build fails, read the log."
- Use the modals can, will, and must. Do not use `should`, `may`, `might`, `could`, or `would`.
- Do not use contractions, semicolons, or em-dashes.
- Define a concept term at its first use. Do not define product names.
- Use American spelling.

Do not change code, identifiers, commands, file paths, quoted errors, or text that quotes the official docs. When you change a page, convert the prose that you touch. No tool can guarantee compliance. The official dictionary is free at asd-ste100.org.

## Setup

[mise](https://mise.jdx.dev) installs Node and pnpm from `mise.toml`. You also need [Graphviz](https://graphviz.org) (`dot`) to rebuild diagrams.

```sh
mise install
pnpm install
pnpm dev        # http://localhost:5173
```

## Changing a page

Pages are Markdown files in `docs/<section>/`. Before you commit, run the audit. It compares every function name, string, result, and number in the code with the official chapters.

```sh
pnpm audit:pages
```

If a false positive is unavoidable, add it to `scripts/audit-allow.json`. First compare it with the chapter.

## Reading order and related pages

The file `docs/.vitepress/related.json` lists, for each page, what to read first and which pages cover the same topic. A new page needs an entry. If the entry is missing, the `pagetools` e2e check fails. The command `pnpm audit:pages` makes sure that every path exists.

## Check-yourself questions

The file `docs/.vitepress/quiz.json` holds the questions at the end of a page. Write the answer from the official docs. Each entry names the chapter (`source`) and a sentence fragment (`phrase`) that supports the answer. The command `pnpm audit:pages` makes sure that the sentence is still in the chapter. Ask about what the docs state. Do not ask trivia.

## The glossary

The file `docs/.vitepress/glossary.json` holds the terms that get a hover card at their first mention on a page. The `/glossary` page lists the same terms. A definition is a short paraphrase of the official docs. Each entry names the chapter (`source`) and a sentence fragment (`phrase`) that supports it. The command `pnpm audit:pages` checks the fragment. The `match` field lists the words that trigger the card. The `in` field limits an ordinary English word to the pages where it means the term.

## Changing or adding a diagram

1. Edit or add `docs/diagrams/<page>/<name>.dot`.
2. Run `make`. This needs `dot`. The command generates the `.svg` files and you must commit them.
3. Reference the diagram in the page: `<Diagram name="<page>/<name>" caption="..." />`.

Every diagram can open in a dialog with zoom. A diagram that shows a sequence can also run step by step. To do this, give its arrows `id=step1`, `id=step2`, and so on in the `.dot` file. Graphviz does not keep the declaration order. Then write `<Diagram steps name="..." caption="..." />`. The page reads the label of each arrow as the step, so make the label say what happens.

Colors come from `docs/.vitepress/theme/diagram.css`, not from the `.dot` file. Use the classes `hl`, `bad`, and `dim`. Keep the text readable on a phone. Wide left-to-right diagrams shrink, so prefer top-to-bottom. Graphviz stacks sibling clusters in reverse declaration order. In a left-to-right layout, declare the cluster that you want first (the problem) last. Look at the rendered result.

## Before you open a pull request

```sh
pnpm audit:pages
pnpm run build:site
pnpm e2e          # every page, phone layout, search, and axe (light/dark, desktop/phone)
```

CI runs the same checks. If one fails, CI blocks the deploy. If you change `favicon.svg` or `scripts/og.html`, run `pnpm assets`.

Keep a pull request to one change. In the description, state first what the reader will see differently. Then state the mechanics.

## "Under the hood" sections

A page can have one optional collapsed section. It explains what a construct does in memory, on the CPU, or on storage: `<UnderTheHood> ... </UnderTheHood>`. This section is our own explanation. It does not come from the official chapters, and its title says so. The rules are stricter than for the rest of the page.

- Cite or demonstrate every claim. Cite the Erlang/OTP docs, the BEAM Book, or a man page. Alternatively, show a snippet that you ran and its output. State the platform and the OTP version for each number that you measured.
- Report timings as ranges from at least two runs. Timings change by tens of percent between runs. In one repeat, `Enum.at` moved from 2.4 to 1.7 ms and a restart moved from 199 to 146 microseconds. Sizes in words are exact and repeat.
- Measure. Do not rely on memory. The size table in the Erlang memory guide is from OTP 19. It is wrong by one word for tuples and lists. Use `:erts_debug.flat_size/1`, `:erlang.process_info/2`, `:beam_disasm`, or `strace -f -y -Y`.
- If a construct has no memory, CPU, or storage story, do not add a section.
- Name the diagrams `uth-<name>.dot`. One glob in `REUSE.toml` then applies the MIT license (original work).
- The audit (`pnpm audit:pages`) skips these sections and the diagrams that only they use. Review them by hand.

## When the official docs change

When the official chapters change, a weekly workflow opens an `upstream-drift` issue. To handle the issue, do these steps:

1. Run `pnpm upstream:diff <slug>`.
2. Update the page.
3. Run `pnpm upstream:update`.

## Licensing

Site code is MIT. Pages and diagrams that come from the Elixir documentation are Apache-2.0 (see `NOTICE` and `REUSE.toml`). When you contribute, you agree that your change has the license that applies to the files it touches. Add a new content section under `docs/<section>/` to the content globs in `REUSE.toml`.

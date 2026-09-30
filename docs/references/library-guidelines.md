# Library guidelines

Source: [Elixir reference, Library guidelines](https://elixir.hexdocs.pm/library-guidelines.html).

General guidelines for writing and publishing Elixir libraries meant for other developers.

## Getting started

`mix new my_library`. The name is `snake_case`, like variables, function names and atoms (see [Naming conventions](./naming-conventions)). The `mix.exs` file says how to build, compile and test. Libraries usually have `lib/` for Elixir sources and `test/`, and may have `src/` for Erlang.
`--sup` scaffolds a project with a supervision tree.

## Publishing

Writing code is one step of many. The guidelines recommend:

<Diagram name="library-guidelines/publishing" caption="From mix new to HexDocs." />

- **A versioning schema.** Elixir requires `MAJOR.MINOR.PATCH`, but the meaning is yours. Most projects pick Semantic Versioning.
- **A license.** The MIT License and Apache 2.0 are the most common, and Apache 2.0 is Elixir's own.
- **The formatter.** `mix format` gives your library the community's consistent style.
- **Tests.** ExUnit ships with Elixir, and `mix new` includes sample tests and doctests.
- **Documentation.** Complete API docs with examples for modules, types and functions. ExDoc builds HTML and EPUB, and supports "extra pages" such as tutorials, guides and cheatsheets.
- **Best practices.** Read the [anti-patterns](../anti-patterns/what-anti-patterns), especially the [process-related](../anti-patterns/process-anti-patterns) and [meta-programming](../anti-patterns/macro-anti-patterns) ones, which matter most to library authors.

Publish as a Hex package (Hex also has private packages for organizations). With ExDoc configured, publishing also publishes the docs to HexDocs.

## Dependency handling

As a dependency, your library runs in `:prod` by default. Dependencies useful only for development or testing need the `:only` option. **Optional** dependencies aren't forced on your users. Test the no-optional case with
`mix compile --no-optional-deps --warnings-as-errors`.

Your library's `mix.lock` is **ignored by the host project**. When someone runs `mix deps.get`, they get the newest versions allowed by your `deps` requirements, possibly newer than your lockfile. Contributors need a deterministic build, so commit `mix.lock`. To cover both, run two CI workflows:

<Diagram name="library-guidelines/lockfile" caption="The lockfile helps you, not your users." />

One relies on `mix.lock`. The other starts with `mix deps.unlock --all` and tests against the latest versions, perhaps nightly.

### Dependency version requirements

Overly strict requirements hurt your users. `{:some_dep, "== 0.2.3"}` blocks bug-fix upgrades. When in doubt, use `"~> x.y"`, which allows newer minor and patch versions but not a new major. Pre-1.0 libraries under Semantic Versioning promise nothing, so depend on the full patch version: `"~> 0.1.2"`.

A common mistake is using `"~> x.y.z"` to mean "at least x.y.z". If you need a fix from 1.2.1, `"~> 1.2.1"` blocks users from 1.3.0 and up. Write `"~> 1.2 and >= 1.2.1"` instead: anything below 2.0 and at least 1.2.1.

<Diagram name="library-guidelines/version-requirements" caption="Each requirement and the versions it accepts." />

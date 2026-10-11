# Library guidelines

Source: [Elixir reference, Library guidelines](https://elixir.hexdocs.pm/library-guidelines.html).

These are general guidelines to write and publish Elixir libraries for other developers.

## Getting started

Run `mix new my_library`. The name is `snake_case`, as for variables, function names, and atoms (see [Naming conventions](./naming-conventions)). The `mix.exs` file says how to build, compile, and test. Libraries usually have `lib/` for Elixir sources and `test/`. They can have `src/` for Erlang. `--sup` makes a project with a supervision tree.

## Publishing

Writing code is one of many steps. The guidelines recommend these items:

<Diagram name="library-guidelines/publishing" caption="From mix new to HexDocs." />

- **A versioning schema.** Elixir requires `MAJOR.MINOR.PATCH`, but you decide the meaning. Most projects choose Semantic Versioning.
- **A license.** The MIT License and Apache 2.0 are the most common. Apache 2.0 is the license of Elixir.
- **The formatter.** `mix format` gives your library the consistent style of the community.
- **Tests.** ExUnit comes with Elixir, and `mix new` includes sample tests and doctests.
- **Documentation.** Write complete API docs with examples for modules, types, and functions. ExDoc builds HTML and EPUB, and supports "extra pages" such as tutorials, guides, and cheatsheets.
- **Best practices.** Read the [anti-patterns](../anti-patterns/what-anti-patterns). The [process-related](../anti-patterns/process-anti-patterns) and [meta-programming](../anti-patterns/macro-anti-patterns) anti-patterns are the most important for library authors.

Publish the library as a Hex package (Hex also has private packages for organizations). If you configure ExDoc, the publication also publishes the docs to HexDocs.

## Dependency handling

As a dependency, your library runs in `:prod` by default. Dependencies that are useful only for development or testing need the `:only` option. **Optional** dependencies are not forced on your users. Test the case without optional dependencies with `mix compile --no-optional-deps --warnings-as-errors`.

The **host project ignores** the `mix.lock` of your library. When someone runs `mix deps.get`, they get the newest versions that your `deps` requirements allow. These can be newer than your lockfile. Contributors need a deterministic build, so commit `mix.lock`. To cover both cases, run two CI workflows:

<Diagram name="library-guidelines/lockfile" caption="The lockfile helps you and not your users." />

One workflow uses `mix.lock`. The other workflow starts with `mix deps.unlock --all` and tests against the latest versions, for example every night.

### Dependency version requirements

Requirements that are too strict harm your users. `{:some_dep, "== 0.2.3"}` blocks upgrades with bug fixes. When in doubt, use `"~> x.y"`. It allows newer minor and patch versions but not a new major version. Libraries before 1.0 that use Semantic Versioning promise nothing, so depend on the full patch version: `"~> 0.1.2"`.

A common mistake is to use `"~> x.y.z"` to mean "at least x.y.z". If you need a fix from 1.2.1, `"~> 1.2.1"` blocks users from 1.3.0 and later versions. Write `"~> 1.2 and >= 1.2.1"` instead. This allows anything below 2.0 and at least 1.2.1.

<Diagram name="library-guidelines/version-requirements" caption="Each requirement and the versions that it accepts." />

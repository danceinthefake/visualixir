# Naming conventions

Source: [Elixir reference, Naming conventions](https://elixir.hexdocs.pm/naming-conventions.html).

Casing to punctuation. A convention is a subset of the syntax, and sets best practice for the language and community. For the full syntax see the [Syntax reference](./syntax-reference).

<Diagram name="naming-conventions/conventions" caption="Every convention on one page." />

## Casing

- **`snake_case`** for variables, function names, module attributes and the like.
- **`CamelCase`** for aliases (module names), keeping acronyms capitalized: `OptionParser`, `ExUnit.CaptureIO`, `Mix.SCM`.
- Atoms may be `:snake_case` or `:CamelCase`, but `snake_case` is the convention.
- File names follow the module's `snake_case`: `MyApp` lives in `my_app.ex`. That's only a convention, because file names don't affect compiled code.

## Underscore (`_foo`)

A value you don't use goes to `_` or a variable starting with `_`: `{:ok, _contents} = File.read("README.md")`.

Functions starting with `_` are **never imported** by default. Elixir uses that for compile-time metadata, usually in the `__foo__` format: every module has `__info__/1`, and there are the special forms `__CALLER__/0`, `__DIR__/0`, `__ENV__/0`,
`__MODULE__/0` and `__STACKTRACE__/0`.

## Trailing bang (`foo!`)

A function or macro whose failure cases **raise**. It usually pairs with a version returning `:ok`/`:error` tuples (or `nil`): `File.read/1` returns `{:ok, _}` or `{:error, :enoent}`, while `File.read!/1` returns the plain value or raises `File.Error`.

- Use the plain version when you want to handle outcomes with pattern matching.
- Use the bang version when you expect success (the file must exist): it raises a more helpful error than a failed pattern match.

Errors from **invalid argument types** always raise, bang or not (`File.read(123)` raises `FunctionClauseError`). More pairs: `Base.decode16/2` and `decode16!/2`, `File.cwd/0` and `cwd!/0`. Some bang functions have no plain counterpart, leaving room for one later
(`Protocol.assert_protocol!/1`).

## Trailing question mark and `is_`

<Diagram name="naming-conventions/boolean-naming" caption="Both name a boolean check. The guard rule decides which." />

- **`foo?`** for functions that return a boolean: `Keyword.keyword?/1`, `Mix.debug?/0`, `String.contains?/2`.
- **`is_foo`** for type and boolean checks **allowed in guards**, following the Erlang convention: `is_list/1`, `Integer.is_even/1`. Checks that aren't valid in guards don't use it (`Keyword.keyword?/1`).
- Never combine `?` with `is_`.

## Special names

### length and size

`size` means **constant time** (the size is stored with the data): `map_size/1`, `tuple_size/1`. `length` means **linear time** (the whole structure is traversed): `length/1`, `String.length/1`.

### get, fetch, fetch!

<Diagram name="naming-conventions/get-fetch" caption="Three ways to read a key, three ways to say it's missing." />

For key-value data structures:

- `get` returns the value, or a default (itself `nil` unless you give one) when the key is missing.
- `fetch` returns `{:ok, value}`, or `:error` when the key is missing.
- `fetch!` returns the value, or **raises** when the key is missing.

Examples: `Map.get/2`, `Map.fetch/2`, `Map.fetch!/2`, and the same in `Keyword`.

### compare

`compare/2` returns `:lt`, `:eq` or `:gt`. This exact convention is what `Enum.sort/2` expects (`DateTime.compare/2` is an example).

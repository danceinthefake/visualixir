# Naming conventions

Source: [Elixir reference, Naming conventions](https://elixir.hexdocs.pm/naming-conventions.html).

This page covers casing and punctuation. A convention is a subset of the syntax. It sets best practice for the language and the community. For the full syntax, see the [Syntax reference](./syntax-reference).

<Diagram name="naming-conventions/conventions" caption="Every convention on one page." />

## Casing

- Use **`snake_case`** for variables, function names, module attributes, and similar names.
- Use **`CamelCase`** for aliases (module names), and keep acronyms capitalized: `OptionParser`, `ExUnit.CaptureIO`, `Mix.SCM`.
- Atoms can be `:snake_case` or `:CamelCase`, but `snake_case` is the convention.
- File names follow the `snake_case` of the module: `MyApp` lives in `my_app.ex`. This is only a convention, because file names do not affect compiled code.

## Underscore (`_foo`)

Send a value that you do not use to `_` or to a variable that starts with `_`: `{:ok, _contents} = File.read("README.md")`.

By default, Elixir **never imports** functions that start with `_`. Elixir uses them for compile-time metadata, usually in the `__foo__` format. Every module has `__info__/1`, and there are the special forms `__CALLER__/0`, `__DIR__/0`, `__ENV__/0`, `__MODULE__/0`, and `__STACKTRACE__/0`.

## Trailing bang (`foo!`)

This is a function or macro with failure cases that **raise** errors. It usually pairs with a version that returns `:ok` and `:error` tuples (or `nil`). `File.read/1` returns `{:ok, _}` or `{:error, :enoent}`, and `File.read!/1` returns the plain value or raises `File.Error`.

- Use the plain version when you want to handle outcomes with pattern matching.
- Use the bang version when you expect success (the file must exist). It raises a more helpful error than a failed pattern match.

Errors from **invalid argument types** always raise an error, with or without a bang (`File.read(123)` raises `FunctionClauseError`). More pairs are `Base.decode16/2` and `decode16!/2`, and `File.cwd/0` and `cwd!/0`. Some bang functions have no plain counterpart. This leaves room for one later (`Protocol.assert_protocol!/1`).

## Trailing question mark and `is_`

<Diagram name="naming-conventions/boolean-naming" caption="Both name a boolean check. The rule about guards decides which one to use." />

- **`foo?`** is for functions that return a boolean: `Keyword.keyword?/1`, `Mix.debug?/0`, `String.contains?/2`.
- **`is_foo`** is for type and boolean checks that you can use **in guards**, as in the Erlang convention: `is_list/1`, `Integer.is_even/1`. Checks that are not valid in guards do not use it (`Keyword.keyword?/1`).
- Never use `?` and `is_` together.

## Special names

### length and size

`size` means **constant time** (the size is stored with the data): `map_size/1`, `tuple_size/1`. `length` means **linear time** (the function traverses the whole structure): `length/1`, `String.length/1`.

### get, fetch, fetch!

<Diagram name="naming-conventions/get-fetch" caption="Three ways to read a key, and three ways to report that it is missing." />

These apply to key-value data structures:

- `get` returns the value. When the key is missing, it returns a default (`nil` unless you give one).
- `fetch` returns `{:ok, value}`. When the key is missing, it returns `:error`.
- `fetch!` returns the value. When the key is missing, it **raises** an error.

Examples: `Map.get/2`, `Map.fetch/2`, `Map.fetch!/2`, and the same functions in `Keyword`.

### compare

`compare/2` returns `:lt`, `:eq`, or `:gt`. `Enum.sort/2` expects exactly this convention (`DateTime.compare/2` is an example).

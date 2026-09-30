# Syntax reference

Source: [Elixir reference, Syntax reference](https://elixir.hexdocs.pm/syntax-reference.html).

Elixir's syntax converts straightforwardly to an abstract syntax tree (AST). It's mostly uniform, with a few syntax-sugar constructs that reduce noise in common idioms. This page covers each construct and then its AST.

## Reserved words

- `true`, `false`, `nil`: atoms
- `when`, `and`, `or`, `not`, `in`: operators
- `fn`: anonymous functions
- `do`, `end`, `catch`, `rescue`, `after`, `else`: do-end blocks

## Data types

### Numbers

Digits, optionally separated by `_` (`1_000_000`). Integers have no dot. Floats have a dot and at least one digit after it, and support scientific notation (`123.4e10`).

### Atoms

- **Unquoted:** a colon, then a Unicode letter or `_`, then letters, numbers, `_` and `@`. May end in `!` or `?`: `:ok`, `:ISO8601`, `:integer?`.
- **Quoted:** `:"…"` or `:'…'` allows any Unicode character: `:"++olá++"`, `:"123"`. Quoted and unquoted atoms with the same name are equal (`:atom`, `:"atom"`, `:'atom'`), but the compiler warns about needless quotes.
- All operators are valid atoms (`:++`). Invalid: `:@foo`, `:123`, `:(*)`.
- `true`, `false` and `nil` are the atoms `:true`, `:false` and `:nil`.

### Strings

Double quotes, UTF-8 binaries. Heredocs use `"""`, end with a newline, and the indentation of the closing `"""` is stripped from every line. Strings are their own AST.

### Charlists

Lists of code points. `'abc' === [97, 98, 99]`. Written in single quotes, with `'''` for multi-line, both deprecated in favor of the `~c` sigil. Charlists are their own AST.

### Lists, tuples, binaries, maps, structs

`[...]`, `{...}` and `<<...>>` with comma separators (a trailing comma is allowed). Maps are `%{"hello" => 1}`. Maps with atom keys and keyword lists have keyword notation: `%{hello: "world"}` is `%{:hello => "world"}` and `[foo: :bar]` is `[{:foo, :bar}]`. Structs put a name between `%` and `{`: `%User{...}`.

## Expressions

- **Variables:** start with `_` or a lowercase Unicode letter, then letters, numbers and `_`. May end in `?` or `!`. Convention: `snake_case`.
- **Local calls:** `add(1, 2)`, following the variable rules. Zero-arity calls need parentheses to avoid ambiguity with variables, and they must touch the name: `add (1, 2)` is a syntax error.
- **Operators:** calls with precedence and associativity. `=`, `when`, `&` and `@` are simply operators. See [Operators](./operators).
- **Remote calls:** `Math.add(1, 2)`, including operators (`Kernel.+(1, 2)`) and quoted names (`Math."++add++"(1, 2)`). `mod.fun()` is a call, while `map.field` (no parentheses) accesses a field.
- **Aliases:** expand to atoms at compile time. See below.
- **Module attributes:** the unary `@` with a variable or local call: `@foo "value"` writes, `@foo` reads.
- **Blocks:** expressions separated by newlines or `;`. Parentheses create one anywhere.

### Aliases

An alias starts with an ASCII uppercase letter, then ASCII letters, numbers or `_` (no non-ASCII). It expands to an atom, and the dot is part of the name.

<Diagram name="syntax-reference/aliases" caption="An alias is an atom with an Elixir. prefix." />

### The arrow `->`

Relates a left side (zero or more arguments) to a right side (zero or more expressions). It appears one or more times between `do`-`end`, `fn`-`end` or `(`-`)`, and when it does, only other clauses may sit between those terminators.

<Diagram name="syntax-reference/arrow" caption="Three places for clauses." />

### Sigils

`~`, then one lowercase letter or one or more uppercase letters, then one of the pairs `()` `{}` `[]` `<>` `""` `''` `||` `//`, then optional ASCII letter or digit modifiers. A sigil is a call to `sigil_` plus the letter: the first argument is the contents as a string, the second is the modifiers as a list of integers.
An uppercase letter disables interpolation: `~s/f#{"o"}o/` interpolates and `~S/f#{"o"}o/` doesn't.

## The Elixir AST

The AST is a regular Elixir data structure of atoms, integers, floats, strings, lists, two-element tuples, and **three-element tuples** for calls and variables. A call `sum(1, 2, 3)` is `{:sum, meta, [1, 2, 3]}`: an atom (or another tuple), a metadata keyword list (such as line numbers), and an argument list. `quote` reveals it.

<Diagram name="syntax-reference/ast-map" caption="Source constructs and their AST." />

Notes on the table:

- A variable is `{:sum, [], Elixir}`: the third element is the variable's context.
- `.` is an operator too. A remote call has two arguments (the second always an atom). Calling an anonymous function has one, mirroring the "missing" name.
- Aliases: all arguments after the first are atoms. `__MODULE__.Bar.Baz` puts a `__MODULE__` call first.
- Lists, and two-element tuples, are literals: `quote do: [1, 2, 3]` is `[1, 2, 3]` and `quote do: {1, 2}` is `{1, 2}`.
- Blocks are `__block__` calls: `quote do 1; 2; 3; end` is `{:__block__, [], [1, 2, 3]}`.
- `->` is always inside a list. `case 1 do 2 -> 3; 4 -> 5 end` is `{:case, [], [1, [do: [{:->, [], [[2], 3]}, {:->, [], [[4], 5]}]]]}`. Between parentheses it's a bare list of clauses, and `fn` wraps the clauses: `{:fn, [], [{:->, [], [[1, 2], 3]}, …]}`.
- **Qualified tuples** (`Foo.{Bar, Baz}`, used for multi-alias) are a `:{}` call on the dot, shown in the block below.
- **`do`-`end` blocks** are keywords as the last argument, with the contents wrapped in parentheses: `if true do this else that end` is `if(true, do: (this), else: (that))`. Only `after`, `catch`, `else` and `rescue` are allowed as extra block keywords (in `receive`, `try` and the like). See [Optional syntax](../getting-started/optional-syntax).

The qualified tuple `Foo.{Bar, Baz}`:

```elixir
quote do
  Foo.{Bar, Baz}
end
#=> {{:., [], [{:__aliases__, [], [:Foo]}, :{}]}, [],
#    [{:__aliases__, [], [:Bar]}, {:__aliases__, [], [:Baz]}]}
```

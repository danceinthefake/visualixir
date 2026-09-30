# Quote and unquote

Source: [Elixir guide, Quote and unquote](https://elixir.hexdocs.pm/quote-and-unquote.html).

Meta-programming rests on one idea: an Elixir program can be represented by Elixir's own data structures. This chapter looks at those structures and at
`quote/2` and `unquote/1`. Macros and DSLs build on them.

## Quoting

The building block of a program is a **three-element tuple**. `sum(1, 2, 3)` is:

```elixir
quote do: sum(1, 2, 3)
#=> {:sum, [], [1, 2, 3]}
```

<Diagram name="quote-and-unquote/triple" caption="Name, metadata, arguments." />

Operators are calls too: `quote do: 1 + 2` is `{:+, [context: Elixir, import: Kernel], [1, 2]}`. A map is a call to `%{}`:
`{:%{}, [], [{1, 2}]}`. A **variable** has an atom, not a list, in the third slot: `quote do: x` is `{:x, [], Elixir}`.

Nested code makes a tree, which other languages call an abstract syntax tree (AST). Elixir calls it a **quoted expression**:

```elixir
quote do: sum(1, 2 + 3, 4)
#=> {:sum, [], [1, {:+, [context: Elixir, import: Kernel], [2, 3]}, 4]}
```

<Diagram name="quote-and-unquote/ast-tree" caption="Each call is a node. Its arguments are its children." />

`Macro.to_string/1` turns a quoted expression back into text: `"sum(1, 2 + 3, 4)"`.

The general shape is `{atom | tuple, list, list | atom}`:

- the first element is an atom, or another tuple in the same shape
- the second is a keyword list of metadata (line numbers, contexts)
- the third is the list of arguments, or an atom if the tuple is a variable

Five literals quote to **themselves**: atoms, numbers, lists, strings and two-element tuples.

<Diagram name="quote-and-unquote/literals" caption="Almost everything is a tuple. Five literals are not." />

## Unquoting

`quote` gives you the code as written. To inject a *value* into it, use `unquote/1`:

```elixir
number = 13
Macro.to_string(quote do: 11 + number)            #=> "11 + number"
Macro.to_string(quote do: 11 + unquote(number))   #=> "11 + 13"
```

<Diagram name="quote-and-unquote/unquote" caption="Without unquote the variable stays a variable. With it, the value replaces it." />

`unquote/1` can also inject a function name: `quote do: unquote(fun)(:world)` with `fun = :hello` gives `"hello(:world)"`.

To inject many values into a list, use `unquote_splicing/1`. Plain `unquote` nests the list:

```elixir
inner = [3, 4, 5]
Macro.to_string(quote do: [1, 2, unquote(inner), 6])            #=> "[1, 2, [3, 4, 5], 6]"
Macro.to_string(quote do: [1, 2, unquote_splicing(inner), 6])   #=> "[1, 2, 3, 4, 5, 6]"
```

<Diagram name="quote-and-unquote/splicing" caption="unquote inserts one thing. unquote_splicing spreads a list." />

A macro receives code chunks and injects them into other chunks. That is how code transformation and code generation at compile time work.

## Escaping

Not every value is a valid quoted expression: a map isn't, and neither is a four-element tuple. Such a value can be *expressed* as one, so to
inject it into quoted code, escape it first:

```elixir
Macro.escape(%{hello: :world})
#=> {:%{}, [], [hello: :world]}
```

<Diagram name="quote-and-unquote/escape" caption="A value and a quoted expression are different things." />

Keep the two apart: a regular value (a list, a map, a process, a reference) versus a quoted expression. Integers, atoms and strings are their own quoted form. Maps must be
converted. Functions and references cannot be converted at all. The `Macro` module has many functions for working with the AST.

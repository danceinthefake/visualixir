# Quote and unquote

Source: [Elixir guide, Quote and unquote](https://elixir.hexdocs.pm/quote-and-unquote.html).

Meta-programming rests on one idea: the data structures of Elixir can represent an Elixir program. This chapter looks at those structures and at `quote/2` and `unquote/1`. Macros and DSLs build on them.

## Quoting

The building block of a program is a **tuple with three elements**. `sum(1, 2, 3)` is:

```elixir
quote do: sum(1, 2, 3)
#=> {:sum, [], [1, 2, 3]}
```

<Diagram name="quote-and-unquote/triple" caption="The name, the metadata, and the arguments." />

Operators are also calls: `quote do: 1 + 2` is `{:+, [context: Elixir, import: Kernel], [1, 2]}`. A map is a call to `%{}`: `{:%{}, [], [{1, 2}]}`. A **variable** has an atom, not a list, in the third position: `quote do: x` is `{:x, [], Elixir}`.

Nested code makes a tree. Other languages call it an abstract syntax tree (AST). Elixir calls it a **quoted expression**:

```elixir
quote do: sum(1, 2 + 3, 4)
#=> {:sum, [], [1, {:+, [context: Elixir, import: Kernel], [2, 3]}, 4]}
```

<Diagram name="quote-and-unquote/ast-tree" caption="Each call is a node. Its arguments are its children." />

`Macro.to_string/1` turns a quoted expression back into text: `"sum(1, 2 + 3, 4)"`.

The general shape is `{atom | tuple, list, list | atom}`:

- The first element is an atom, or another tuple in the same shape.
- The second element is a keyword list of metadata (line numbers and contexts).
- The third element is the list of arguments, or an atom if the tuple is a variable.

Five literals quote to **themselves**: atoms, numbers, lists, strings, and tuples with two elements.

<Diagram name="quote-and-unquote/literals" caption="Almost everything is a tuple. Five literals are not." />

<UnderTheHood>

**A quoted expression is ordinary data on the heap.** `quote do: sum(1, 2, 3)` is the tuple `{:sum, [], [1, 2, 3]}`. It uses 4 words for the tuple and 6 words for the list of arguments, 10 words in all (`:erts_debug.flat_size/1`). A nested call adds its own tuple and metadata: `sum(1, 2 + 3, 4)` took 38 words. The `+` carries `[context: Elixir, import: Kernel]`. A function of three lines is 28 bytes as source text. After the parser reads it with its line information, it is 640 bytes of heap. Nothing here is special to the VM. The compiler walks these tuples and lists as it walks any others, and macros receive and return them.

<Diagram name="quote-and-unquote/uth-ast" caption="Quoted code is tuples and lists on the heap, with a cost in words like any other term." />

*Sources:* we measured on Elixir 1.20 / OTP 29. The sizes depend on the metadata that the parser adds.

</UnderTheHood>

## Unquoting

`quote` gives you the code as you wrote it. To inject a *value* into it, use `unquote/1`:

```elixir
number = 13
Macro.to_string(quote do: 11 + number)            #=> "11 + number"
Macro.to_string(quote do: 11 + unquote(number))   #=> "11 + 13"
```

<Diagram name="quote-and-unquote/unquote" caption="Without unquote, the variable stays a variable. With unquote, the value replaces it." />

`unquote/1` can also inject a function name: `quote do: unquote(fun)(:world)` with `fun = :hello` gives `"hello(:world)"`.

To inject many values into a list, use `unquote_splicing/1`. A plain `unquote` nests the list:

```elixir
inner = [3, 4, 5]
Macro.to_string(quote do: [1, 2, unquote(inner), 6])            #=> "[1, 2, [3, 4, 5], 6]"
Macro.to_string(quote do: [1, 2, unquote_splicing(inner), 6])   #=> "[1, 2, 3, 4, 5, 6]"
```

<Diagram name="quote-and-unquote/splicing" caption="unquote inserts one item. unquote_splicing spreads a list." />

A macro receives chunks of code and injects them into other chunks. This is how code transformation and code generation work at compile time.

## Escaping

Not every value is a valid quoted expression. A map is not, and a tuple with four elements is not. You can *express* such a value as a quoted expression. To inject it into quoted code, escape it first:

```elixir
Macro.escape(%{hello: :world})
#=> {:%{}, [], [hello: :world]}
```

<Diagram name="quote-and-unquote/escape" caption="A value and a quoted expression are different things." />

Keep the two apart: a regular value (a list, a map, a process, a reference) and a quoted expression. Integers, atoms, and strings are their own quoted form. You must convert maps. You cannot convert functions and references at all. The `Macro` module has many functions to work with the AST.

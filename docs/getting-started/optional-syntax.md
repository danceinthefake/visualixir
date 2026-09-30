# Optional syntax sheet

Source: [Elixir guide, Optional syntax sheet](https://elixir.hexdocs.pm/optional-syntax.html).

Elixir lets you omit a few delimiters. Four rules explain all of them, and they keep the core of the language tiny.

Start from this:

```elixir
if variable? do
  Call.this()
else
  Call.that()
end
```

Now take the conveniences away, one at a time:

<Diagram name="optional-syntax/walkthrough" caption="Each step undoes one convenience. The last line is what the compiler sees." />

1. `do`-`end` blocks are keywords: `if variable?, do: Call.this(), else: Call.that()`
2. A keyword list as the last argument needs no square brackets.
3. A keyword list is a list of two-element tuples: `[{:do, …}, {:else, …}]`
4. Parentheses are optional on function calls.

## Why it matters

`if`, `def` and `defmodule` are not special keywords with their own grammar. They are ordinary calls built from these four rules. So
this:

```elixir
defmodule Math do
  def add(a, b) do
    a + b
  end
end
```

is just:

```elixir
defmodule(Math, [
  {:do, def(add(a, b), [{:do, a + b}])}
])
```

That's what lets you extend the language with the same constructs it is built from (see meta-programming).

You don't have to apply these rules by hand: `mix format` does. It always adds parentheses to calls unless configured otherwise.

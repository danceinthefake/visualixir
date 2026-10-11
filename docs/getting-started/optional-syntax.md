# Optional syntax sheet

Source: [Elixir guide, Optional syntax sheet](https://elixir.hexdocs.pm/optional-syntax.html).

Elixir lets you omit a few delimiters. Four rules explain all of them, and they keep the core of the language small.

Start with this code:

```elixir
if variable? do
  Call.this()
else
  Call.that()
end
```

Now remove the conveniences, one at a time:

<Diagram steps name="optional-syntax/walkthrough" caption="Each step removes one convenience. The last line is what the compiler sees." />

1. `do`-`end` blocks are keywords: `if variable?, do: Call.this(), else: Call.that()`
2. A keyword list as the last argument does not need square brackets.
3. A keyword list is a list of two-element tuples: `[{:do, …}, {:else, …}]`
4. Parentheses are optional in function calls.

## Why it matters

`if`, `def`, and `defmodule` are not special keywords with their own grammar. They are ordinary calls that these four rules build. So this code:

```elixir
defmodule Math do
  def add(a, b) do
    a + b
  end
end
```

is the same as this code:

```elixir
defmodule(Math, [
  {:do, def(add(a, b), [{:do, a + b}])}
])
```

For this reason, you can extend the language with the same constructs that build it (see meta-programming).

You do not need to apply these rules by hand. `mix format` does it. Unless you configure it otherwise, it always adds parentheses to calls.

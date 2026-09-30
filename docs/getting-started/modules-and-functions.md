# Modules and functions

Source: [Elixir guide, Modules and functions](https://elixir.hexdocs.pm/modules-and-functions.html).

`defmodule` groups functions. The module name (an *alias*) starts with an uppercase letter,
function names with lowercase or `_`.

```elixir
defmodule Math do
  def sum(a, b) do
    a + b
  end
end

Math.sum(1, 2)   #=> 3
```

## Scripting

`.ex` files are compiled. `.exs` files are scripts. Elixir treats them the same, the difference is intent.
Run one with `elixir math.exs`, or load it into a shell with `iex math.exs`.

## Public and private

`def` is callable from other modules. `defp` is private to the module.

<Diagram name="modules-and-functions/visibility" caption="Only def functions cross the module boundary." />

## Clauses and guards

A function can have several clauses. Elixir tries them top to bottom and runs the first that
matches. No match raises `FunctionClauseError`.

```elixir
defmodule Math do
  def zero?(0), do: true
  def zero?(x) when is_integer(x), do: false
end

Math.zero?(0)          #=> true
Math.zero?(1)          #=> false
Math.zero?([1, 2, 3])  #=> ** (FunctionClauseError)
```

<Diagram name="modules-and-functions/clauses" caption="Same top-to-bottom matching as case." />

A trailing `?` conventionally means the function returns a boolean. `do:` is fine for one-liners,
use `do` blocks for anything longer.

## Default arguments

```elixir
def join(a, b, sep \\ " "), do: a <> sep <> b
```

The default is evaluated **each time it's used**, not when the function is defined. With several
clauses, declare defaults once in a body-less *function head*, which can't have patterns or guards:

```elixir
def join(a, b, sep \\ " ")
def join(a, b, _sep) when b == "", do: a
def join(a, b, sep), do: a <> sep <> b
```

## Aliases are atoms

A capitalized name like `String` is an *alias* that becomes an atom at compile time:
`String` is `:"Elixir.String"`. Modules on the Erlang VM are always atoms, and the `Elixir.` prefix keeps
Elixir modules from clashing with Erlang ones. That is also how you call Erlang: `:lists.flatten([1, [2], 3])`.

<Diagram name="modules-and-functions/aliases" caption="Elixir modules are namespaced atoms. Erlang modules are plain atoms." />

## Nesting

`defmodule Foo do defmodule Bar do end end` defines two independent modules, `Foo` and `Foo.Bar`.
Inside `Foo` you can write `Bar`. Outside you need the full name or an `alias`. `Foo` doesn't have to
exist before `Foo.Bar`.

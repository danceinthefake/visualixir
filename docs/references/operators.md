# Operators reference

Source: [Elixir reference, Operators reference](https://elixir.hexdocs.pm/operators.html).

This page explains how Elixir parses, defines, and overrides operators.

## General operators

<Diagram name="operators/kinds" caption="Four groups of operators." />

These are the built-in general operators:

| Operator | Meaning |
|---|---|
| `+` `-` (unary) | positive, negative |
| `+` `-` `*` `/` | arithmetic |
| `++` `--` | list concatenation and subtraction |
| `and` / `&&` | strict / relaxed boolean and |
| `or` / `\|\|` | strict / relaxed boolean or |
| `not` / `!` | strict / relaxed boolean not |
| `in` `not in` | membership |
| `@` | module attribute |
| `..` `..//` | range creation |
| `<>` | binary concatenation |
| `\|>` | pipeline |
| `=~` | text-based match |

Many of them work in guards (see [Patterns and guards](./patterns-and-guards)). **Special forms** cannot be overridden: `^` pin, `.` dot, `=` match, `&` capture, `::` type. The next operators appear in the precedence table but have a meaning only in a construct: `=>` (in `%{}`), `when` (guards), `<-` (`for`, `with`), `\\` (default arguments).

## Comparison operators

`==`, `===`, `!=`, `!==`, `<`, `>`, `<=`, and `>=` can all be used in guards. `===` differs from `==` only because it is strict about integers and floats:

```elixir
1 == 1.0    #=> true
1 === 1.0   #=> false
```

## Precedence and associativity

This list has every operator that Elixir can parse, from higher to lower precedence:

<Diagram name="operators/precedence" caption="Higher rows bind more strongly." />

There are two ternary operators: `first..last//step` (right) and `%{map | key => value, ...}` (none).

Associativity decides ties on the same row, and precedence decides between different rows:

<Diagram name="operators/associativity" caption="The same operator twice, or different operators together." />

`not left in right` and `!left in right` currently parse as `not(left in right)`. This is different from the table. It is deprecated and gives a warning. Write `left not in right`. A future major version will follow the table.

## Custom and overridden operators

Elixir parses a fixed set of operators, so you cannot invent new ones. But not every operator that it parses is *used*: `+` and `||` are used, and `<~>` is valid but not used. Define an operator with `def` (or `defp`, `defmacro`) in operator syntax:

```elixir
defmodule MyOperators do
  def a ~> b, do: max(a, b)
  def a <~ b, do: min(a, b)
end

import MyOperators
1 ~> 2   #=> 2
1 <~ 2   #=> 1
```

You **must import** the module to use the operators. These operators are parsed but not used by default: `|||`, `&&&`, `<<<`, `>>>`, `<<~`, `~>>`, `<~`, `~>`, `<~>`, `+++`, `---`, `...`. `Bitwise` uses `&&&`, `<<<`, `>>>`, and `|||` when you import it.

The community discourages custom operators, which have no descriptive name, although some DSLs justify them. It is strongly discouraged to replace predefined operators such as `+`.

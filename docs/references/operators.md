# Operators reference

Source: [Elixir reference, Operators reference](https://elixir.hexdocs.pm/operators.html).

How operators are parsed, defined and overridden.

## General operators

<Diagram name="operators/kinds" caption="Four groups of operators." />

Built-in general operators:

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

Many work in guards (see [Patterns and guards](./patterns-and-guards)). **Special forms** that cannot be overridden: `^` pin, `.` dot, `=` match, `&` capture, `::` type. And these appear in the precedence table but only mean something in a construct: `=>` (in `%{}`),
`when` (guards), `<-` (`for`, `with`), `\\` (default arguments).

## Comparison operators

`==`, `===`, `!=`, `!==`, `<`, `>`, `<=`, `>=`, all usable in guards. `===` differs from `==` only in being strict about integers and floats:

```elixir
1 == 1.0    #=> true
1 === 1.0   #=> false
```

## Precedence and associativity

Every operator Elixir can parse, from higher to lower precedence:

<Diagram name="operators/precedence" caption="Higher rows bind tighter." />

Two ternary operators: `first..last//step` (right) and `%{map | key => value, ...}` (none).

Associativity settles ties on the same row, and precedence settles different rows:

<Diagram name="operators/associativity" caption="Same operator twice, or different operators together." />

`not left in right` and `!left in right` currently parse as `not(left in right)`, which contradicts the table. That is deprecated and warns. Write `left not in right`. A future major version will follow the table.

## Custom and overridden operators

Elixir parses a fixed set of operators, so you can't invent new ones. But not every operator it parses is *used*: `+` and `||` are, `<~>` is valid but unused. Define one with `def` (or `defp`, `defmacro`) using operator syntax:

```elixir
defmodule MyOperators do
  def a ~> b, do: max(a, b)
  def a <~ b, do: min(a, b)
end

import MyOperators
1 ~> 2   #=> 2
1 <~ 2   #=> 1
```

You **must import** the module to use them. Parsed but unused by default: `|||`, `&&&`, `<<<`, `>>>`, `<<~`, `~>>`, `<~`, `~>`, `<~>`, `+++`, `---`, `...`. `Bitwise` uses `&&&`, `<<<`, `>>>` and `|||` when imported.

The community discourages custom operators, which have no descriptive name, though some DSLs justify them. Replacing predefined operators such as `+` is extremely discouraged.

# Patterns and guards

Source: [Elixir reference, Patterns and guards](https://elixir.hexdocs.pm/patterns-and-guards.html).

Pattern matching asserts on the shape of data or extracts values from it. Guards add more complex, but deliberately limited, checks.

## Patterns

Patterns are made of variables, literals and data-structure syntax. They are allowed only on the **left** of `=`. The right side is evaluated normally, and patterns are not bidirectional:
`1 = y` with an unbound `y` is a `CompileError` (undefined variable).

### Variables

A variable in a pattern is always assigned, so rebinding is allowed. Use `^` to compare against the current value instead:

```elixir
x = 1
x = 2          # rebinds
^x = 2         # ok now
^x = 3         #=> ** (MatchError)
```

If a variable appears more than once in one pattern, all occurrences must be the same value: `{x, x} = {1, 1}` matches, `{x, x} = {1, 2}` doesn't. A variable cannot be defined through itself
(`{:ok, x} = {x, :ok}` is a cyclic definition and is rejected). `_` can never be bound or read. A pinned value is compared as a *value*, not as a pattern: `{:ok, ^x} = {:ok, %{a: 13}}` fails when `x = %{}`.

### Literals

Atoms and numbers match only themselves, and numbers compare **strictly**: `1 = 1.0` is a `MatchError`.

### Tuples and lists

Both match only the **same size**, with every element matching. Lists also support `[head | tail]`, where several elements may precede the `|`, and which never matches `[]`:

```elixir
{:ok, integer} = {:ok, 11, 13}       #=> ** (MatchError)   (size differs)
[first, second | tail] = [1, 2, 3]   # tail = [3]
[head | tail] = []                   #=> ** (MatchError)
~c"hello " ++ world = ~c"hello world"   # world = ~c"world"
```

Prefix matches on charlists work with `++`. Suffix matches (`hello ++ ~c" world"`) are not valid patterns.

### Maps

A map pattern does a **subset** match: it matches any map that has at least the pattern's keys. The empty map matches every map, unlike an empty list or tuple. Keys in patterns must be
literals or pinned variables.

<Diagram name="patterns-and-guards/map-subset" caption="A map pattern needs its keys, and doesn't mind extra ones." />

### Structs

`%User{name: name} = %User{name: "meg"}` works. An unknown key is a compile error, and `%struct_name{} = value` extracts the struct's name.

### Binaries

`<<>>` can match several segments, each with its own type, size and unit (`<<val::unit(8)-size(2)-integer>> = <<123, 56>>`). Since strings are binaries, prefix matches work with `<>`:
`"hello " <> world = "hello world"`. Suffix matches are invalid.

## Guards

Guards go through `when`. Only a handful of expressions are allowed, on purpose: guards stay predictable (no side effects) and can be optimized.

Allowed:

- comparison operators (`==`, `!=`, `===`, `!==`, `<`, `<=`, `>`, `>=`), `max`, `min`
- strictly boolean `and`, `or`, `not`. **Not** `&&`, `||` and `!`, since they don't require booleans
- arithmetic `+`, `-`, `*`, `/` (unary and binary)
- `in` and `not in` with a list or range on the right
- type checks (`is_list/1`, `is_number/1`, …) and functions on built-in types (`abs/1`, `hd/1`, `map_size/1`, …)
- the `map.field` syntax
- some `Bitwise` operations, and macros built from any of the above (like `Integer.is_even/1`)

```elixir
def empty_map?(map) when map_size(map) == 0, do: true
def empty_map?(map) when is_map(map), do: false
```

Pattern matching alone can't do this: `%{}` matches *any* map.

### A guard must be `true`

A clause runs only if its guard evaluates to exactly `true`. There is no truthy or falsy:

```elixir
def not_nil_head?([head | _]) when head, do: true      # "some_value" is not `true`
def not_nil_head?([head | _]) when head != nil, do: true   # correct
```

<Diagram name="patterns-and-guards/guard-true" caption="Only true passes." />

### Errors in guards

A function that would raise makes the **guard fail** instead. `tuple_size("hello")` in a guard just means no match, so `tuple_size/1` checks both "is a tuple" and its size. With several conditions, put type checks
before it (`is_tuple(x) and tuple_size(x) == 2`).

### Multiple guards

Repeating `when` chains guards as an `or`, and a failing guard (from an error) just moves on to the next:

```elixir
def empty?(val) when map_size(val) == 0 or tuple_size(val) == 0, do: true   # empty?({}) is false!

def empty?(val)
    when map_size(val) == 0
    when tuple_size(val) == 0,
    do: true                                                                 # empty?({}) is true
```

<Diagram name="patterns-and-guards/guard-errors" caption="An error inside one or-ed guard fails all of it. Separate guards are tried one by one." />

## Where they are allowed

<Diagram name="patterns-and-guards/where" caption="Everything that matches accepts a pattern, and most accept guards." />

```elixir
match?({:ok, value} when value > 0, {:ok, 13})

case x do
  1 -> :one
  n when is_integer(n) and n > 2 -> :larger_than_two
end

for x when x >= 0 <- [1, -2, 3, -4], do: x
```

`with` also allows patterns and guards in `else`. `try` supports them in `catch` and `else`, and `receive` uses them to select messages.

The match operator `=` supports patterns but **not** guards: `{:ok, binary} = File.read("some/file")` has no `when`.

## Custom guards

Only these constructs are valid in patterns and guards, but macros that expand into them are fine. `Record` provides such macros for named tuple fields. For guards, use `defguard/1` and `defguardp/1`,
which add compile-time checks:

```elixir
defmodule MyInteger do
  defguard is_even(term) when is_integer(term) and rem(term, 2) == 0
end

import MyInteger, only: [is_even: 1]
def my_function(number) when is_even(number), do: …
```

An infinite set like "the even integers" can't be matched by a pattern, so it needs a guard.

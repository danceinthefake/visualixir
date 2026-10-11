# Patterns and guards

Source: [Elixir reference, Patterns and guards](https://elixir.hexdocs.pm/patterns-and-guards.html).

Pattern matching asserts the shape of data or extracts values from it. Guards add more complex checks, which are limited on purpose.

## Patterns

Patterns are made of variables, literals, and data-structure syntax. They are allowed only on the **left** of `=`. Elixir evaluates the right side in the normal way, and patterns are not bidirectional: `1 = y` with an unbound `y` is a `CompileError` (undefined variable).

### Variables

Elixir always assigns a variable in a pattern, so you can rebind it. Use `^` to compare against the current value instead:

```elixir
x = 1
x = 2          # rebinds
^x = 2         # ok now
^x = 3         #=> ** (MatchError)
```

If a variable appears more than once in one pattern, all occurrences must have the same value: `{x, x} = {1, 1}` matches and `{x, x} = {1, 2}` does not. A variable cannot be defined through itself (`{:ok, x} = {x, :ok}` is a cyclic definition and Elixir rejects it). You can never bind or read `_`. Elixir compares a pinned value as a *value* and not as a pattern: `{:ok, ^x} = {:ok, %{a: 13}}` fails when `x = %{}`.

### Literals

Atoms and numbers match only themselves, and numbers compare **strictly**: `1 = 1.0` is a `MatchError`.

### Tuples and lists

Both types match only the **same size**, and every element must match. Lists also support `[head | tail]`, where several elements can come before the `|`, and which never matches `[]`:

```elixir
{:ok, integer} = {:ok, 11, 13}       #=> ** (MatchError)   (size differs)
[first, second | tail] = [1, 2, 3]   # tail = [3]
[head | tail] = []                   #=> ** (MatchError)
~c"hello " ++ world = ~c"hello world"   # world = ~c"world"
```

Prefix matches on charlists work with `++`. Suffix matches (`hello ++ ~c" world"`) are not valid patterns.

### Maps

A map pattern does a **subset** match: it matches any map that has at least the keys of the pattern. The empty map matches every map, which is different from an empty list or tuple. Keys in patterns must be literals or pinned variables.

<Diagram name="patterns-and-guards/map-subset" caption="A map pattern needs its keys, and extra keys do not matter." />

### Structs

`%User{name: name} = %User{name: "meg"}` works. An unknown key is a compile error, and `%struct_name{} = value` extracts the name of the struct.

### Binaries

`<<>>` can match several segments, each with its own type, size, and unit (`<<val::unit(8)-size(2)-integer>> = <<123, 56>>`). Strings are binaries, so prefix matches work with `<>`: `"hello " <> world = "hello world"`. Suffix matches are not valid.

## Guards

Guards use `when`. Only a few expressions are allowed, on purpose: guards stay predictable (no side effects) and the compiler can optimize them.

These expressions are allowed:

- comparison operators (`==`, `!=`, `===`, `!==`, `<`, `<=`, `>`, `>=`), `max`, `min`
- strictly boolean `and`, `or`, `not`. **Not** `&&`, `||`, and `!`, because they do not require booleans
- arithmetic `+`, `-`, `*`, `/` (unary and binary)
- `in` and `not in` with a list or range on the right
- type checks (`is_list/1`, `is_number/1`, …) and functions on built-in types (`abs/1`, `hd/1`, `map_size/1`, …)
- the `map.field` syntax
- some `Bitwise` operations, and macros that are built from any of the above (like `Integer.is_even/1`)

```elixir
def empty_map?(map) when map_size(map) == 0, do: true
def empty_map?(map) when is_map(map), do: false
```

Pattern matching alone cannot do this: `%{}` matches *any* map.

### A guard must be `true`

A clause runs only if its guard evaluates to exactly `true`. There is no truthy or falsy:

```elixir
def not_nil_head?([head | _]) when head, do: true      # "some_value" is not `true`
def not_nil_head?([head | _]) when head != nil, do: true   # correct
```

<Diagram name="patterns-and-guards/guard-true" caption="Only true passes." />

### Errors in guards

A function that raises an error makes the **guard fail** instead. `tuple_size("hello")` in a guard means only that there is no match, so `tuple_size/1` checks that the value is a tuple and checks its size. With several conditions, put type checks before it (`is_tuple(x) and tuple_size(x) == 2`).

### Multiple guards

Repeated `when` clauses chain guards with `or`. A guard that fails (from an error) moves on to the next guard:

```elixir
def empty?(val) when map_size(val) == 0 or tuple_size(val) == 0, do: true   # empty?({}) is false!

def empty?(val)
    when map_size(val) == 0
    when tuple_size(val) == 0,
    do: true                                                                 # empty?({}) is true
```

<Diagram name="patterns-and-guards/guard-errors" caption="An error inside one guard with or makes all of it fail. Separate guards are tried one by one." />

<UnderTheHood>

**Why an error in a guard only fails the guard.** We compiled `when map_size(m) == 0` and the same expression in a function body, and read both with `:beam_disasm`. In the body, the `map_size` instruction has the failure label `0`, which means "raise the error". In the guard, it has a real label (16). If the argument is not a map, the instruction jumps there, to the next clause, and nothing is raised. So the rule that guards fail and do not raise is not a special case that the system checks at runtime. It is how the compiler wires the instruction.

<Diagram name="patterns-and-guards/uth-guard-fail" caption="In a guard, the same instruction jumps to the next clause on failure and does not raise." />

*Sources:* we disassembled with `:beam_disasm` on Elixir 1.20 / OTP 29.

</UnderTheHood>

## Where patterns and guards are allowed

<Diagram name="patterns-and-guards/where" caption="Everything that matches accepts a pattern, and most constructs accept guards." />

```elixir
match?({:ok, value} when value > 0, {:ok, 13})

case x do
  1 -> :one
  n when is_integer(n) and n > 2 -> :larger_than_two
end

for x when x >= 0 <- [1, -2, 3, -4], do: x
```

Function clauses (`def`, `defp`) and anonymous functions (`fn`) also support patterns and guards, as `case` clauses do. `with` also allows patterns and guards in `else`. `try` supports them in `catch` and `else`, and `receive` uses them to select messages.

The match operator `=` supports patterns but **not** guards: `{:ok, binary} = File.read("some/file")` has no `when`.

## Custom guards

Only these constructs are valid in patterns and guards, but macros that expand into them are acceptable. `Record` provides such macros for named tuple fields. For guards, use `defguard/1` and `defguardp/1`, which add compile-time checks:

```elixir
defmodule MyInteger do
  defguard is_even(term) when is_integer(term) and rem(term, 2) == 0
end

import MyInteger, only: [is_even: 1]
def my_function(number) when is_even(number), do: …
```

A pattern cannot match an infinite set such as "the even integers", so it needs a guard.

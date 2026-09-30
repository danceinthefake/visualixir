# Pattern matching

Source: [Elixir guide, Pattern matching](https://elixir.hexdocs.pm/pattern-matching.html).

In Elixir `=` is the *match operator*, not assignment. It succeeds when the left side can be made
equal to the right side, and binds variables on the left as a side effect.

## Destructuring a tuple

```elixir
{a, b, c} = {:hello, "world", 42}
```

Both sides are three-element tuples, so they line up field by field. Each variable takes the value
opposite it.

<Diagram name="pattern-matching/tuple" caption="{a, b, c} = {:hello, &quot;world&quot;, 42}: a = :hello, b = &quot;world&quot;, c = 42" />

## Head and tail of a list

```elixir
[head | tail] = [1, 2, 3]
```

A list is a chain of cells, each holding a value and a pointer to the rest. `[head | tail]` splits
off the first cell: `head` is its value, `tail` is everything after it.

<Diagram name="pattern-matching/cons" caption="head = 1, tail = [2, 3]" />

The `|` also works in reverse to build a list: `[0 | [1, 2, 3]]` is `[0, 1, 2, 3]`.

## Ignoring values with `_`

```elixir
[head | _] = [1, 2, 3]
head
#=> 1
```

`_` matches anything and binds nothing. You can't read it back. Use it for the parts of the shape you
don't care about.

<Diagram name="pattern-matching/underscore" caption="[head | _] = [1, 2, 3]: head = 1, the rest is thrown away" />

## When the match fails

A match succeeds only if the shapes line up **and** every literal in the pattern equals the value
opposite it. Otherwise Elixir raises `MatchError`.

```elixir
{:ok, result} = {:ok, 13}
#=> {:ok, 13}

{:ok, result} = {:error, :oops}
#=> ** (MatchError) no match of right hand side value: {:error, :oops}
```

`:ok` is a literal, so it has to equal `:error`. It doesn't, the match stops there, and `result` is
never bound.

<Diagram name="pattern-matching/mismatch" caption="{:ok, result} = {:error, :oops} fails on the first field" />

The same happens when the sizes differ (`{a, b, c} = {:hello, "world"}`) or the types differ
(`{a, b, c} = [:hello, "world", 42]`).

## The pin operator

A variable on the left of `=` is normally **rebound**:

```elixir
x = 1
x = 2
x
#=> 2
```

Put `^` in front and it becomes a **check** against the value `x` already holds:

```elixir
x = 1
^x = 2
#=> ** (MatchError) no match of right hand side value: 2

{y, ^x} = {2, 1}
#=> {2, 1}
```

<Diagram name="pattern-matching/pin" caption="Without ^ the name moves to the new value. With ^ the old value is compared, and 1 ≠ 2 fails." />

Next: [Case, cond and if](https://elixir.hexdocs.pm/case-cond-and-if.html) is where patterns get used to pick a branch.

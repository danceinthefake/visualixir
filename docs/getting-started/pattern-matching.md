# Pattern matching

Source: [Elixir guide, Pattern matching](https://elixir.hexdocs.pm/pattern-matching.html).

This chapter explains why `=` is called the *match operator*, how to pattern match inside data structures, and how the pin operator `^` accesses a value that is already bound.

## The match operator

`=` looks like assignment, but it is a **match**. The two sides must be equal:

```elixir
x = 1
1 = x       #=> 1
2 = x       #=> ** (MatchError) no match of right hand side value: 1
```

`1 = x` is a valid expression: both sides are `1`, so it matches. When they aren't equal, Elixir raises `MatchError`.

A variable can only be assigned on the **left** of `=`:

```elixir
1 = unknown
#=> ** (CompileError) iex:1: undefined variable "unknown"
```

## Pattern matching

The match operator also **destructures** complex data types. Tuples first:

```elixir
{a, b, c} = {:hello, "world", 42}
a   #=> :hello
b   #=> "world"
```

Both sides are three-element tuples, so they line up field by field. Each variable takes the value opposite it.

<Diagram name="pattern-matching/tuple" caption="{a, b, c} = {:hello, &quot;world&quot;, 42}: a = :hello, b = &quot;world&quot;, c = 42" />

If the sides can't line up, the match fails. That happens when the sizes differ, or when the types differ (a tuple on the left, a list on the right):

```elixir
{a, b, c} = {:hello, "world"}
#=> ** (MatchError) no match of right hand side value: {:hello, "world"}

{a, b, c} = [:hello, "world", 42]
#=> ** (MatchError) no match of right hand side value: [:hello, "world", 42]
```

You can also match on **specific values**. This pattern only matches a tuple that starts with the atom `:ok`:

```elixir
{:ok, result} = {:ok, 13}
result   #=> 13

{:ok, result} = {:error, :oops}
#=> ** (MatchError) no match of right hand side value: {:error, :oops}
```

`:ok` is a literal, so the first element of the right side must also be `:ok`. It is `:error`, so the match stops there and `result` is never bound.

<Diagram name="pattern-matching/mismatch" caption="{:ok, result} = {:error, :oops} fails on the first field" />

### Lists

Lists work the same way: `[a, b, c] = [1, 2, 3]` binds `a` to `1`, and so on.

A list can also be matched on its own **head and tail**:

```elixir
[head | tail] = [1, 2, 3]
head   #=> 1
tail   #=> [2, 3]
```

A list is a chain of cells, each holding a value and a pointer to the rest. `[head | tail]` splits off the first cell: `head` is its value, `tail` is everything after it.

<Diagram name="pattern-matching/cons" caption="head = 1, tail = [2, 3]" />

Like `hd/1` and `tl/1`, this can't match an empty list:

```elixir
[head | tail] = []
#=> ** (MatchError) no match of right hand side value: []
```

The `[head | tail]` form isn't only for matching. It also **prepends** to a list:

```elixir
list = [1, 2, 3]
[0 | list]   #=> [0, 1, 2, 3]
```

### Ignoring values with `_`

When you don't care about part of a pattern, bind it to `_`. If only the head matters, throw the tail away:

```elixir
[head | _] = [1, 2, 3]
head   #=> 1
```

<Diagram name="pattern-matching/underscore" caption="[head | _] = [1, 2, 3]: head = 1, the rest is thrown away" />

`_` can never be **read**. Using it in an expression is a compile error:

```elixir
_
#=> ** (CompileError) iex:1: invalid use of _. "_" represents a value to be ignored in a pattern and cannot be used in expressions
```

### The same variable twice

If a variable appears more than once in a pattern, every occurrence must bind to the same value:

```elixir
{x, x} = {1, 1}   #=> {1, 1}
{x, x} = {1, 2}   #=> ** (MatchError) no match of right hand side value: {1, 2}
```

<Diagram name="pattern-matching/repeated" caption="One name, one value." />

### Limits

Pattern matching is powerful but limited. You can't call functions on the left side of a match:

```elixir
length([1, [2], 3]) = 3
#=> ** (CompileError) iex:1: cannot invoke remote function :erlang.length/1 inside match
```

Destructuring is one of the foundations of recursion in Elixir, and it applies to other types too, like maps and binaries.

<UnderTheHood>

**What the compiler turns a match into.** Matching is a handful of tests and loads. For `{:ok, v} = result` the compiled code (read with `:beam_disasm`) is `is_tagged_tuple`, which checks "a tuple of this size whose first element is `:ok`", then `get_tuple_element`, which loads element 1 into a register. There is no `test_heap` or `put_*` instruction: matching doesn't allocate and doesn't copy, and `v` is the same word that was already inside `result`. For `[head | tail]` it is `is_nonempty_list` and `get_hd` (the tail comes the same way). If a test fails, the code jumps to the next clause, or raises `MatchError`.

**Repeated variables and the pin.** Matching a tuple against `{x, x}` loads both elements, then compares them with `is_eq_exact`. The pin does the same: `^y` is an `is_eq_exact` between two registers.

<Diagram name="pattern-matching/uth-match" caption="A match is a few tests, then loads from the existing data." />

*Sources:* instructions read with `:beam_disasm` on Erlang/OTP 29 and Elixir 1.20. The instruction names are the VM's.

</UnderTheHood>

## The pin operator

Variables can be **rebound**:

```elixir
x = 1
x = 2
```

Sometimes you don't want that. Use the pin operator `^` to match against a variable's *existing value* instead of rebinding it:

```elixir
x = 1
^x = 2
#=> ** (MatchError) no match of right hand side value: 2
```

Since `x` was pinned while bound to `1`, that is equivalent to `1 = 2`, and you get the exact same error message.

<Diagram name="pattern-matching/pin" caption="Without ^ the name moves to the new value. With ^ the old value is compared, and 1 ≠ 2 fails." />

The pin also works inside other patterns, such as lists and tuples:

```elixir
x = 1
[^x, 2, 3] = [1, 2, 3]   #=> [1, 2, 3]
{y, ^x} = {2, 1}          # y = 2
{y, ^x} = {2, 2}          #=> ** (MatchError) no match of right hand side value: {2, 2}
```

Because `x` was `1` when it was pinned, the last line could have been written `{y, 1} = {2, 2}`.

Next, [case, cond, and if](./case-cond-and-if) shows patterns picking a branch, and they can be extended with guards.

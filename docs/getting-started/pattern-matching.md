# Pattern matching

Source: [Elixir guide, Pattern matching](https://elixir.hexdocs.pm/pattern-matching.html).

This chapter explains why `=` is the *match operator*, how to pattern match inside data structures, and how the pin operator `^` works. The pin operator accesses a value that is already bound.

## The match operator

`=` looks like an assignment, but it is a **match**. The two sides must be equal:

```elixir
x = 1
1 = x       #=> 1
2 = x       #=> ** (MatchError) no match of right hand side value: 1
```

`1 = x` is a valid expression. Both sides are `1`, so it matches. When the sides are not equal, Elixir raises `MatchError`.

You can assign a variable only on the **left** of `=`:

```elixir
1 = unknown
#=> ** (CompileError) iex:1: undefined variable "unknown"
```

## Pattern matching

The match operator also **destructures** complex data types. Tuples are first:

```elixir
{a, b, c} = {:hello, "world", 42}
a   #=> :hello
b   #=> "world"
```

Both sides are tuples with three elements, so they line up field by field. Each variable takes the value opposite it.

<Diagram name="pattern-matching/tuple" caption="{a, b, c} = {:hello, &quot;world&quot;, 42}: a = :hello, b = &quot;world&quot;, c = 42" />

If the sides cannot line up, the match fails. This happens when the sizes are different, or when the types are different (a tuple on the left and a list on the right):

```elixir
{a, b, c} = {:hello, "world"}
#=> ** (MatchError) no match of right hand side value: {:hello, "world"}

{a, b, c} = [:hello, "world", 42]
#=> ** (MatchError) no match of right hand side value: [:hello, "world", 42]
```

You can also match on **specific values**. This pattern matches only a tuple that starts with the atom `:ok`:

```elixir
{:ok, result} = {:ok, 13}
result   #=> 13

{:ok, result} = {:error, :oops}
#=> ** (MatchError) no match of right hand side value: {:error, :oops}
```

`:ok` is a literal, so the first element of the right side must also be `:ok`. It is `:error`, so the match stops there and `result` is never bound.

<Diagram name="pattern-matching/mismatch" caption="{:ok, result} = {:error, :oops} fails on the first field" />

### Lists

Lists work in the same way: `[a, b, c] = [1, 2, 3]` binds `a` to `1`, and so on.

You can also match a list on its own **head and tail**:

```elixir
[head | tail] = [1, 2, 3]
head   #=> 1
tail   #=> [2, 3]
```

A list is a chain of cells. Each cell holds a value and a pointer to the rest. `[head | tail]` splits off the first cell: `head` is its value and `tail` is everything after it.

<Diagram name="pattern-matching/cons" caption="head = 1, tail = [2, 3]" />

As with `hd/1` and `tl/1`, this cannot match an empty list:

```elixir
[head | tail] = []
#=> ** (MatchError) no match of right hand side value: []
```

The `[head | tail]` form is not only for matching. It also **prepends** to a list:

```elixir
list = [1, 2, 3]
[0 | list]   #=> [0, 1, 2, 3]
```

### Ignore values with `_`

When you do not need part of a pattern, bind it to `_`. If only the head is important, throw the tail away:

```elixir
[head | _] = [1, 2, 3]
head   #=> 1
```

<Diagram name="pattern-matching/underscore" caption="[head | _] = [1, 2, 3]: head = 1, the rest is thrown away" />

You can never **read** `_`. If you use it in an expression, you get a compile error:

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

Pattern matching has limits. You cannot call functions on the left side of a match:

```elixir
length([1, [2], 3]) = 3
#=> ** (CompileError) iex:1: cannot invoke remote function :erlang.length/1 inside match
```

Destructuring is one of the foundations of recursion in Elixir. It also applies to other types, for example maps and binaries.

<UnderTheHood>

**In short:** a match only checks the shape of the data and reads values that are already there. It builds nothing new.

**What the compiler turns a match into.** A match is a few checks followed by reads. For `{:ok, v} = result`, the compiled code asks: "is this a tuple of the right size?" Then it asks: "is the first element `:ok`?" Then it loads element 1 into a register. The code allocates nothing and copies nothing: `v` is the same word that was already inside `result`. For `[head | tail]`, the code uses `is_nonempty_list` and `get_hd`, and the tail comes in the same way. There is no `test_heap` or `put_*` instruction. If a check fails, the code jumps to the next clause, or raises `MatchError`.

**Repeated variables and the pin.** To match a tuple against `{x, x}`, the code loads both elements and compares them. The pin works in the same way: `^y` compares two values that are already there.

<Diagram name="pattern-matching/uth-match" caption="A match is a few tests, and then loads from the existing data." />

*Sources:* we read the instructions with `:beam_disasm` on Erlang/OTP 29 and Elixir 1.20. The instructions are `is_tagged_tuple` and `get_tuple_element`, `is_nonempty_list` and `get_hd`, and `is_eq_exact` for repeated variables and the pin. There is no `test_heap` or `put_*` instruction. These are the instructions that build data.

</UnderTheHood>

## The pin operator

You can **rebind** variables:

```elixir
x = 1
x = 2
```

Sometimes you do not want this. Use the pin operator `^` to match against the *existing value* of a variable and not rebind it:

```elixir
x = 1
^x = 2
#=> ** (MatchError) no match of right hand side value: 2
```

`x` was pinned while it was bound to `1`. This is equivalent to `1 = 2`, and you get the same error message.

<Diagram name="pattern-matching/pin" caption="Without ^, the name moves to the new value. With ^, Elixir compares the old value, and 1 ≠ 2 fails." />

The pin also works inside other patterns, such as lists and tuples:

```elixir
x = 1
[^x, 2, 3] = [1, 2, 3]   #=> [1, 2, 3]
{y, ^x} = {2, 1}          # y = 2
{y, ^x} = {2, 2}          #=> ** (MatchError) no match of right hand side value: {2, 2}
```

`x` was `1` when you pinned it, so you can write the last line as `{y, 1} = {2, 2}`.

Next, [case, cond, and if](./case-cond-and-if) shows patterns that pick a branch. You can extend them with guards.

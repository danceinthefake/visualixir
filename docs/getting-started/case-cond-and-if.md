# case, cond, and if

Source: [Elixir guide, case, cond, and if](https://elixir.hexdocs.pm/case-cond-and-if.html).

## case

`case` compares a value against patterns, top to bottom, and runs the first clause that matches.

```elixir
case {1, 2, 3} do
  {4, 5, 6} -> "This clause won't match"
  {1, x, 3} -> "This clause will match and bind x to 2 in this clause"
  _ -> "This clause would match any value"
end
```

<Diagram name="case-cond-and-if/case-order" caption="First match wins. If no clause matches, Elixir raises CaseClauseError." />

Use `^` to match against an existing variable instead of rebinding it. Add a **guard** with `when`
for extra conditions:

```elixir
x = 1
case 10 do
  ^x -> "Won't match"
  _ -> "Will match"
end

case {1, 2, 3} do
  {1, x, 3} when x > 0 -> "Will match"
  _ -> "Would match, if guard condition were not satisfied"
end
```

An error raised inside a guard doesn't escape. It just makes the guard fail, and the next clause is
tried:

```elixir
case 1 do
  x when hd(x) -> "Won't match"   # hd(1) raises, so the guard fails
  x -> "Got #{x}"
end
#=> "Got 1"
```

If nothing matches:

```elixir
case :ok do
  :error -> "Won't match"
end
#=> ** (CaseClauseError) no case clause matching: :ok
```

The full list of guards is in the [Patterns and Guards](/references/patterns-and-guards#guards) reference.

<UnderTheHood>

**In short:** `case`, guards and `if` become a few quick checks and jumps, with no function calls.

**What `case` becomes.** When a `case` matches on fixed values, the compiler turns it into a single lookup that jumps straight to the right branch, instead of testing each clause in turn. A guard such as `when is_integer(x) and x > 10` becomes two quick checks, and no function is called. That fits the chapter's note that patterns and guards are limited to expressions the compiler can optimise. An `if` is the same idea: a jump on the condition, where `false` and `nil` take the `else` side.

<Diagram name="case-cond-and-if/uth-select" caption="case, guards and if compile to tests and jumps, with no function calls." />

*Sources:* read with `:beam_disasm` on Erlang/OTP 29 and Elixir 1.20. The instructions are `select_val` (the lookup and jump, also used for `if`), and `is_integer` and `is_ge 11` for the guard. How the compiler lays out a `case` can differ between versions.

</UnderTheHood>

## if

Patterns and guards cover only expressions the compiler can optimize. For anything else, `if`. The
body runs unless the condition is `false` or `nil`, in which case `if` returns `nil`, or the `else`
value.

```elixir
if false do "never seen" end   #=> nil
if nil do "no" else "This will" end   #=> "This will"
```

### Everything is an expression

There are no statements in Elixir. Every construct returns a value, and variables set inside a block
don't leak out of it.

```elixir
x = 1
if true do
  x = x + 1
end
#=> 2
x
#=> 1
```

<Diagram name="case-cond-and-if/scope" caption="The if block reads the outer x but its own x = x + 1 stays inside." />

To keep the change, bind the *result* of the `if`:

```elixir
x = if true do x + 1 else x end
```

That is also why there's no ternary operator: `if` already returns a value. And `if` is a macro,
not a special form.

## cond

`cond` checks several conditions and runs the first one that is neither `nil` nor `false`. It's the
`else if` chain of other languages. If none is truthy, `CondClauseError` is raised, so end with
`true ->` for a default.

```elixir
cond do
  2 + 2 == 5 -> "This will not be true"
  2 * 2 == 3 -> "Nor this"
  true -> "This is always true (equivalent to else)"
end
```

## Which one?

<Diagram name="case-cond-and-if/choose" caption="Prefer patterns and guards. Fall back to if, then cond for several conditions." />

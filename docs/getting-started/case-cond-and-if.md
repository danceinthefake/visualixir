# case, cond, and if

Source: [Elixir guide, case, cond, and if](https://elixir.hexdocs.pm/case-cond-and-if.html).

## case

`case` compares a value with patterns, from top to bottom, and runs the first clause that matches.

```elixir
case {1, 2, 3} do
  {4, 5, 6} -> "This clause won't match"
  {1, x, 3} -> "This clause will match and bind x to 2 in this clause"
  _ -> "This clause would match any value"
end
```

<Diagram name="case-cond-and-if/case-order" caption="The first match wins. If no clause matches, Elixir raises CaseClauseError." />

Use `^` to match against an existing variable and not bind it again. For extra conditions, add a **guard** with `when`:

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

An error that a guard raises does not escape. The guard only fails, and Elixir tries the next clause:

```elixir
case 1 do
  x when hd(x) -> "Won't match"   # hd(1) raises, so the guard fails
  x -> "Got #{x}"
end
#=> "Got 1"
```

If no clause matches:

```elixir
case :ok do
  :error -> "Won't match"
end
#=> ** (CaseClauseError) no case clause matching: :ok
```

The [Patterns and Guards](/references/patterns-and-guards#guards) reference has the full list of guards.

<UnderTheHood>

**In short:** `case`, guards, and `if` become a few quick checks and jumps, with no function calls.

**What `case` becomes.** When a `case` matches on fixed values, the compiler turns it into a single lookup that jumps straight to the correct branch. It does not test each clause in turn. A guard such as `when is_integer(x) and x > 10` becomes two quick checks, and no function is called. This agrees with the note in the chapter that patterns and guards are limited to expressions that the compiler can optimize. An `if` is the same idea: a jump on the condition, where `false` and `nil` take the `else` side.

<Diagram name="case-cond-and-if/uth-select" caption="case, guards, and if compile to tests and jumps, with no function calls." />

*Sources:* we read the code with `:beam_disasm` on Erlang/OTP 29 and Elixir 1.20. The instructions are `select_val` (the lookup and jump, also used for `if`), and `is_integer` and `is_ge 11` for the guard. The layout that the compiler makes for a `case` can differ between versions.

</UnderTheHood>

## if

Patterns and guards cover only expressions that the compiler can optimize. For all other cases, use `if`. The body runs unless the condition is `false` or `nil`. In that case, `if` returns `nil` or the `else` value.

```elixir
if false do "never seen" end   #=> nil
if nil do "no" else "This will" end   #=> "This will"
```

### Everything is an expression

Elixir has no statements. Every construct returns a value, and variables that you set inside a block do not leak out of it.

```elixir
x = 1
if true do
  x = x + 1
end
#=> 2
x
#=> 1
```

<Diagram name="case-cond-and-if/scope" caption="The if block reads the outer x, but its own x = x + 1 stays inside." />

To keep the change, bind the *result* of the `if`:

```elixir
x = if true do x + 1 else x end
```

For the same reason, Elixir has no ternary operator: `if` already returns a value. Also, `if` is a macro and not a special form.

## cond

`cond` checks several conditions and runs the first one that is not `nil` or `false`. It is the `else if` chain of other languages. If no condition is truthy, Elixir raises `CondClauseError`, so end with `true ->` for a default.

```elixir
cond do
  2 + 2 == 5 -> "This will not be true"
  2 * 2 == 3 -> "Nor this"
  true -> "This is always true (equivalent to else)"
end
```

## Which one to use?

<Diagram name="case-cond-and-if/choose" caption="Prefer patterns and guards. Use if as a fallback. Use cond for several conditions." />

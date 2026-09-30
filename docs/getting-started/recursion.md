# Recursion

Source: [Elixir guide, Recursion](https://elixir.hexdocs.pm/recursion.html).

Elixir has no loop constructs. Data is immutable, so a loop is a function that calls itself until a condition stops it.

## Loops through recursion

```elixir
defmodule Recursion do
  def print_multiple_times(msg, n) when n > 0 do
    IO.puts(msg)
    print_multiple_times(msg, n - 1)
  end

  def print_multiple_times(_msg, 0) do
    :ok
  end
end
```

Clauses are tried top to bottom, like `case`. The first has a guard `n > 0`: print, then recurse with `n - 1`. When `n`
reaches `0`, the guard fails and the second clause matches. This is the *termination clause*. An argument that matches no
clause raises `FunctionClauseError`.

<Diagram name="recursion/print-multiple-times" caption="Each call moves n toward the termination clause." />

## Reduce

Sum a list by carrying an accumulator:

```elixir
def sum_list([head | tail], accumulator), do: sum_list(tail, head + accumulator)
def sum_list([], accumulator), do: accumulator

Math.sum_list([1, 2, 3], 0)   #=> 6
```

`[head | tail]` splits the list, exactly as in [pattern matching](./pattern-matching). Taking a list down to one value
is a *reduce algorithm*.

<Diagram name="recursion/sum-list" caption="The accumulator grows while the list shrinks." />

## Map

To transform every element, build a new list on the way back:

```elixir
def double_each([head | tail]), do: [head * 2 | double_each(tail)]
def double_each([]), do: []

Math.double_each([1, 2, 3])   #=> [2, 4, 6]
```

<Diagram name="recursion/double-each" caption="Calls descend the list. The result is built while they return." />

## In practice

You'll rarely write these by hand. `Enum` already has them:

```elixir
Enum.reduce([1, 2, 3], 0, &+/2)         #=> 6
Enum.map([1, 2, 3], &(&1 * 2))          #=> [2, 4, 6]
```

Recursion with tail-call optimization is still how loops are built underneath.

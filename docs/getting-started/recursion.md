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

Elixir tries the clauses from top to bottom, as `case` does. The first clause has the guard `n > 0`. It prints the message and calls itself with `n - 1`. When `n` is `0`, the guard fails and the second clause matches. This is the *termination clause*. If an argument matches no clause, Elixir raises `FunctionClauseError`.

<Diagram name="recursion/print-multiple-times" caption="Each call moves n closer to the termination clause." />

## Reduce

To add the numbers in a list, carry an accumulator:

```elixir
def sum_list([head | tail], accumulator), do: sum_list(tail, head + accumulator)
def sum_list([], accumulator), do: accumulator

Math.sum_list([1, 2, 3], 0)   #=> 6
```

`[head | tail]` splits the list, as in [pattern matching](./pattern-matching). To reduce a list to one value is a *reduce algorithm*.

<Diagram name="recursion/sum-list" caption="The accumulator grows and the list shrinks." />

## Map

To change every element, build a new list when the calls return:

```elixir
def double_each([head | tail]), do: [head * 2 | double_each(tail)]
def double_each([]), do: []

Math.double_each([1, 2, 3])   #=> [2, 4, 6]
```

<Diagram name="recursion/double-each" caption="The calls go down the list. The result is built when they return." />

<UnderTheHood>

**Two kinds of recursion, two machine behaviors.** In `sum_list(tail, head + accumulator)`, the recursive call is the last action of the function. This is a *tail call*. The compiler turns it into `call_only`, a jump back to the start, and keeps no frame. In `[head * 2 | double_each(tail)]`, the call is not last, because the cons must happen after the call returns. For a function of that shape (we read `head + body(tail)`), the compiled code is `allocate`, `call`, then the work, then `deallocate`. We read it with `:beam_disasm`. There is a *stack frame* for every call that still waits.

<Diagram name="recursion/uth-stack" caption="A tail call is a jump. A call that must return needs a stack frame." />

**What the frames cost.** We used a list of 2 million integers in a new process. After the body-recursive sum, the process used 80,592 KB. After the tail-recursive sum, it used 33,580 KB. The 32 MB list is most of the second number. The difference, about 47,000 KB, is stack: about 3 words (24 bytes) for each waiting call. The stack of a tail-recursive loop does not grow with the length of the list. This is why tail-call optimization is important for loops that you write as recursion.

*Sources:* we read the instructions with `:beam_disasm` and measured the sizes with `Process.info/2` on Erlang/OTP 29, 64-bit Linux.

</UnderTheHood>

## In practice

You will rarely write these functions by hand. `Enum` already has them:

```elixir
Enum.reduce([1, 2, 3], 0, &+/2)         #=> 6
Enum.map([1, 2, 3], &(&1 * 2))          #=> [2, 4, 6]
```

Underneath, loops are still recursion with tail-call optimization.

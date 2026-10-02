# Enumerables and Streams

Source: [Elixir guide, Enumerables and Streams](https://elixir.hexdocs.pm/enumerable-and-streams.html).

Most collection work uses `Enum` and `Stream`, not hand-written recursion.

## Enumerables

`Enum` works on anything that implements the `Enumerable` protocol: lists, maps and ranges are all enumerable.

```elixir
Enum.map([1, 2, 3], fn x -> x * 2 end)                 #=> [2, 4, 6]
Enum.map(%{1 => 2, 3 => 4}, fn {k, v} -> k * v end)    #=> [2, 12]
Enum.map(1..3, fn x -> x * 2 end)                      #=> [2, 4, 6]
```

<Diagram name="enumerable-and-streams/enumerable" caption="Enum functions are polymorphic: any Enumerable will do." />

`Enum` only enumerates. For operations specific to one type, like inserting at a position, use that type's module
(`List.insert_at/3`). See the [Enum cheatsheet](/cheatsheets/enum-cheat) for the full list.

## Eager vs lazy

Every `Enum` function is **eager**. Many take an enumerable and return a list, so a pipeline builds an intermediate list at
every step.

## The pipe operator

`|>` passes the result on its left as the **first argument** of the call on its right:

```elixir
odd? = fn x -> rem(x, 2) != 0 end
1..100_000 |> Enum.map(&(&1 * 3)) |> Enum.filter(odd?) |> Enum.sum()   #=> 7500000000
# same as: Enum.sum(Enum.filter(Enum.map(1..100_000, &(&1 * 3)), odd?))
```

<Diagram name="enumerable-and-streams/pipe" caption="Each result becomes the first argument of the next call." />

## Streams

`Stream` has lazy versions of these functions. A stream is a value describing a computation, so nothing runs until you pass it to `Enum`.

```elixir
1..100_000 |> Stream.map(&(&1 * 3)) |> Stream.filter(odd?) |> Enum.sum()   #=> 7500000000
```

<Diagram name="enumerable-and-streams/eager-vs-lazy" caption="Enum builds a list per step. Stream builds none until Enum asks." />

Streams shine for large or **infinite** collections:

```elixir
stream = Stream.cycle([1, 2, 3])
Enum.take(stream, 10)    #=> [1, 2, 3, 1, 2, 3, 1, 2, 3, 1]
```

Calling `Enum.map/2` on that stream would never finish. `Stream.resource/3` wraps resources so they're opened before enumeration
and closed after, even on failure. `File.stream!/1` is built on it: `"path" |> File.stream!() |> Enum.take(10)` reads only ten lines.

Start with `Enum.map/2` and `Enum.reduce/3`, and reach for `Stream` only when you need laziness.

<UnderTheHood>

**Where the intermediate lists live.** `Enum.map` builds a whole new list on the process heap before `Enum.filter` starts, and `filter` builds another. Measured, running `1..2_000_000 |> Enum.map(&(&1 * 3)) |> Enum.filter(odd?) |> Enum.sum()` in a fresh process left that process with a heap of 75 MB. The `Stream` version of the same pipeline composes the steps into functions and runs each number through all of them, one at a time, so nothing is built up: the heap ended at 609 words.

<Diagram name="enumerable-and-streams/uth-peak-heap" caption="The same pipeline eagerly and lazily: what each leaves on the process heap." />

**Why it is faster here.** The eager run took about 250 ms and the lazy one about 65 ms on this machine. The eager version writes a 2-million-element list and then a 1-million-element one, about 48 MB of list cells at 16 bytes each, and then has to garbage-collect them. The lazy version avoids that work. That is a result for this pipeline: for a small collection, composing functions can cost more than it saves.

*Sources:* measured with `Process.info(pid, :total_heap_size)` and `:timer.tc/1` on Erlang/OTP 29. Eager versus lazy is the chapter's own distinction.

</UnderTheHood>

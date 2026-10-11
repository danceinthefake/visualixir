# Enumerables and Streams

Source: [Elixir guide, Enumerables and Streams](https://elixir.hexdocs.pm/enumerable-and-streams.html).

Most work with collections uses `Enum` and `Stream`, not recursion that you write by hand.

## Enumerables

`Enum` works on anything that implements the `Enumerable` protocol. Lists, maps, and ranges are all enumerable.

```elixir
Enum.map([1, 2, 3], fn x -> x * 2 end)                 #=> [2, 4, 6]
Enum.map(%{1 => 2, 3 => 4}, fn {k, v} -> k * v end)    #=> [2, 12]
Enum.map(1..3, fn x -> x * 2 end)                      #=> [2, 4, 6]
```

<Diagram name="enumerable-and-streams/enumerable" caption="Enum functions are polymorphic. Any Enumerable works." />

`Enum` only enumerates. For operations that are specific to one type, for example to insert at a position, use the module of that type (`List.insert_at/3`). See the [Enum cheatsheet](/cheatsheets/enum-cheat) for the full list.

## Eager and lazy

Every `Enum` function is **eager**. Many of them take an enumerable and return a list, so a pipeline builds an intermediate list at every step.

## The pipe operator

`|>` passes the result on its left as the **first argument** of the call on its right:

```elixir
odd? = fn x -> rem(x, 2) != 0 end
1..100_000 |> Enum.map(&(&1 * 3)) |> Enum.filter(odd?) |> Enum.sum()   #=> 7500000000
# same as: Enum.sum(Enum.filter(Enum.map(1..100_000, &(&1 * 3)), odd?))
```

<Diagram steps name="enumerable-and-streams/pipe" caption="Each result becomes the first argument of the next call." />

## Streams

`Stream` has lazy versions of these functions. A stream is a value that describes a computation, so nothing runs until you pass it to `Enum`.

```elixir
1..100_000 |> Stream.map(&(&1 * 3)) |> Stream.filter(odd?) |> Enum.sum()   #=> 7500000000
```

<Diagram name="enumerable-and-streams/eager-vs-lazy" caption="Enum builds a list at each step. Stream builds no list until Enum asks." />

Streams are good for large or **infinite** collections:

```elixir
stream = Stream.cycle([1, 2, 3])
Enum.take(stream, 10)    #=> [1, 2, 3, 1, 2, 3, 1, 2, 3, 1]
```

`Enum.map/2` on that stream never finishes. `Stream.resource/3` wraps resources so that they open before the enumeration and close after it, also after a failure. `File.stream!/1` uses it: `"path" |> File.stream!() |> Enum.take(10)` reads only ten lines.

Start with `Enum.map/2` and `Enum.reduce/3`. Use `Stream` only when you need laziness.

<UnderTheHood>

**Where the intermediate lists live.** `Enum.map` builds a whole new list on the process heap before `Enum.filter` starts, and `filter` builds another list. We ran `1..2_000_000 |> Enum.map(&(&1 * 3)) |> Enum.filter(odd?) |> Enum.sum()` in a new process. The heap of that process was 75 MB. The `Stream` version of the same pipeline composes the steps into functions and runs each number through all of them, one at a time. It builds up nothing, and the heap ended at 609 words.

<Diagram name="enumerable-and-streams/uth-peak-heap" caption="The same pipeline, eager and lazy: what each leaves on the process heap." />

**Why it is faster here.** The eager run took about 250 ms and the lazy run took about 65 ms on this machine. The eager version writes a list of 2 million elements and then a list of 1 million elements. These are about 48 MB of list cells at 16 bytes each, and the garbage collector must then free them. The lazy version does not do this work. This is a result for this pipeline. For a small collection, the composition of functions can cost more than it saves.

*Sources:* we measured with `Process.info(pid, :total_heap_size)` and `:timer.tc/1` on Erlang/OTP 29. The difference between eager and lazy is from the chapter.

</UnderTheHood>

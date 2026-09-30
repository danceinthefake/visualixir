# Erlang libraries

Source: [Elixir guide, Erlang libraries](https://elixir.hexdocs.pm/erlang-libraries.html).

Elixir and Erlang interoperate directly. Elixir discourages wrapping Erlang libraries and just calls them. Erlang module names are lowercase
atoms, Elixir's are capitalized aliases (which are atoms too), and calls work the same way:

```elixir
String.first("hello")    #=> "h"
:binary.first("hello")   #=> 104
```

<Diagram name="erlang-libraries/map" caption="Common Erlang modules with no Elixir equivalent." />

## :binary

`String` works on UTF-8 text. `:binary` works on raw bytes:

```elixir
String.to_charlist("Ø")   #=> [216]         (a code point)
:binary.bin_to_list("Ø")  #=> [195, 152]    (the bytes)
```

## Formatted output

Elixir has no `printf`. Use `:io.format/2` (to the terminal) or `:io_lib.format/2` (to iodata). Format specifiers differ from C's:

```elixir
:io.format("Pi is approximately given by:~10.3f~n", [:math.pi])
#=> Pi is approximately given by:     3.142
```

## :crypto

Hashing, signatures, encryption:

```elixir
Base.encode16(:crypto.hash(:sha256, "Elixir"))
```

`:crypto` isn't part of the `:kernel` or `:stdlib` applications, so list it in `mix.exs`:

```elixir
def application do
  [extra_applications: [:crypto]]
end
```

The application a module belongs to is shown under the Erlang logo in its docs sidebar.

## :digraph

Directed graphs with shortest-path and cycle algorithms:

```elixir
digraph = :digraph.new()
[v0, v1, v2] = for c <- [{0.0, 0.0}, {1.0, 0.0}, {1.0, 1.0}], do: :digraph.add_vertex(digraph, c)
:digraph.add_edge(digraph, v0, v1)
:digraph.add_edge(digraph, v1, v2)
:digraph.get_short_path(digraph, v0, v2)
#=> [{0.0, 0.0}, {1.0, 0.0}, {1.0, 1.0}]
```

<Diagram name="erlang-libraries/digraph" caption="Three vertices, two edges, one shortest path." />

`:digraph` changes the graph **in place**. That's possible because it's built on ETS tables.

## ETS

`:ets` stores large data (in memory) and `:dets` stores it on disk. A table holds tuples, and works as a small database, key-value store or cache.
By default tables are **protected**: only the owner process writes, anyone can read. Functions modify the table as a side effect.

<Diagram name="erlang-libraries/ets" caption="Protected: one writer, many readers." />

```elixir
table = :ets.new(:ets_test, [])
:ets.insert(table, {"China", 1_374_000_000})
:ets.insert(table, {"India", 1_284_000_000})
```

## :math, :queue, :rand, :zip and :zlib

`:math` covers trigonometry, exponentials and logarithms (`:math.sin/1`, `:math.exp/1`, `:math.log/1`).

`:queue` is an efficient double-ended FIFO queue:

<Diagram name="erlang-libraries/queue" caption="First in, first out. An empty queue returns :empty." />

```elixir
q = :queue.new
q = :queue.in("A", q)
q = :queue.in("B", q)
{value, q} = :queue.out(q)   # value = {:value, "A"}
```

`:rand` gives random values (`:rand.uniform/0`, `:rand.uniform(6)`) and seeding (`:rand.seed/2`). `:zip` reads and writes ZIP
files, `:zlib` does zlib compression (`:zlib.compress/1` and `:zlib.uncompress/1`).

## Learning Erlang

The guide points to Erlang Syntax: A Crash Course (Elixir next to Erlang), the Erlang course on erlang.org, and *Learn You Some Erlang for Great Good!*.

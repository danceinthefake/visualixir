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

<UnderTheHood>

**Who does the work.** `:crypto.hash/2` is a *NIF*, a function written in C that the VM calls directly, and it calls OpenSSL (`:crypto.info_lib()` reports OpenSSL 3.6.4 here). While hashing 256 MB, the OS thread that was running was a dirty IO scheduler (`erts_dios_6`), so the normal schedulers kept running other processes.

**In the hardware.** This CPU has dedicated instructions for hashing and encryption: `sha_ni` and `aes` appear in `/proc/cpuinfo`. Measured, SHA-256 ran at about 2,000 MB/s and MD5, which has no such instruction, at about 900 MB/s. That is consistent with the SHA instructions being used, but I haven't confirmed that OpenSSL uses them on this build.

<Diagram name="erlang-libraries/uth-crypto" caption="A crypto call goes from Elixir into C code, on a dirty scheduler thread, then to the CPU." />

*Sources:* measured on Erlang/OTP 29 with `:timer.tc/1`, `/proc/cpuinfo` and `/proc/self/task`. Throughput depends on the CPU.

</UnderTheHood>

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

<UnderTheHood>

**Where an ETS table lives.** The table is not on any process's heap. After inserting 1,000,000 `{integer, string}` tuples, the owning process's heap measured 2,585 words and `:erlang.memory(:ets)` had grown by 104 MB. Inserting copies the tuple into the table, and a lookup copies the value back into the calling process: looking up a 10,000-element list copied 20,003 words (28 microseconds), while a small value took under a microsecond. So ETS suits many small values read often, and costs more the larger the value you read.

<Diagram name="erlang-libraries/uth-ets" caption="ETS data lives outside every process heap. Writes copy out and reads copy in." />

*Sources:* measured with `:ets.info/2`, `:erlang.memory/1`, `:erts_debug.flat_size/1` and `Process.info/2` on Erlang/OTP 29.

</UnderTheHood>

## :math, :queue, :rand, :zip and :zlib

`:math` covers trigonometry, exponentials and logarithms (`:math.sin/1`, `:math.exp/1`, `:math.log/1`).

`:queue` is an efficient double-ended FIFO queue:

<Diagram name="erlang-libraries/queue" caption="First in, first out. Taking from an empty queue returns {:empty, queue}." />

```elixir
q = :queue.new
q = :queue.in("A", q)
q = :queue.in("B", q)
{value, q} = :queue.out(q)   # value = {:value, "A"}
```

`:rand` gives random values (`:rand.uniform/0`, `:rand.uniform(6)`) and seeding (`:rand.seed/2`). `:zip` reads and writes ZIP
files, `:zlib` does zlib compression (`:zlib.compress/1` and `:zlib.uncompress/1`).

<UnderTheHood>

**What a queue is made of.** A queue built with `:queue.in/2` looked like `{[5, 4, 3, 2], [1]}`: one list for the rear, in reverse, and one for the front. Adding is one cons onto the rear list. Taking takes from the front, and only when the front is empty is the rear list reversed, once. That is why the Erlang docs give both operations as amortized O(1). The docs call the representation opaque, so this is an implementation detail and not something to depend on.

<Diagram name="erlang-libraries/uth-queue" caption="A queue is two lists. The rear is reversed into the front only when the front runs out." />

*Sources:* printed on Erlang/OTP 29; complexity from the [`queue` docs](https://www.erlang.org/doc/apps/stdlib/queue.html).

</UnderTheHood>

## Learning Erlang

The guide points to Erlang Syntax: A Crash Course (Elixir next to Erlang), the Erlang course on erlang.org, and *Learn You Some Erlang for Great Good!*.

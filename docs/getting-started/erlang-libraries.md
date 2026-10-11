# Erlang libraries

Source: [Elixir guide, Erlang libraries](https://elixir.hexdocs.pm/erlang-libraries.html).

Elixir and Erlang work together directly. Elixir discourages wrappers for Erlang libraries. Call them directly. Erlang module names are lowercase atoms. Elixir module names are capitalized aliases (which are atoms too). The calls work in the same way:

```elixir
String.first("hello")    #=> "h"
:binary.first("hello")   #=> 104
```

<Diagram name="erlang-libraries/map" caption="Common Erlang modules that have no Elixir equivalent." />

## :binary

`String` works on UTF-8 text. `:binary` works on raw bytes:

```elixir
String.to_charlist("Ø")   #=> [216]         (a code point)
:binary.bin_to_list("Ø")  #=> [195, 152]    (the bytes)
```

## Formatted output

Elixir has no `printf`. Use `:io.format/2` (to the terminal) or `:io_lib.format/2` (to iodata). The format specifiers are different from the specifiers in C:

```elixir
:io.format("Pi is approximately given by:~10.3f~n", [:math.pi])
#=> Pi is approximately given by:     3.142
```

## :crypto

Hashing, signatures, and encryption:

```elixir
Base.encode16(:crypto.hash(:sha256, "Elixir"))
```

`:crypto` is not part of the `:kernel` or `:stdlib` applications, so list it in `mix.exs`:

```elixir
def application do
  [extra_applications: [:crypto]]
end
```

The docs of a module show the application that it belongs to under the Erlang logo in the sidebar.

<UnderTheHood>

**Who does the work.** `:crypto.hash/2` is a *NIF*, a function that is written in C and that the VM calls directly. It calls OpenSSL (`:crypto.info_lib()` reports OpenSSL 3.6.4 here). While it hashed 256 MB, the OS thread that ran was a dirty IO scheduler (`erts_dios_6`), so the normal schedulers kept running other processes.

**In the hardware.** This CPU has dedicated instructions for hashing and encryption: `sha_ni` and `aes` appear in `/proc/cpuinfo`. We measured SHA-256 at about 2,040 MB/s and MD5, which has no such instruction, at about 940 MB/s (the same in two runs). This agrees with use of the SHA instructions, but we did not confirm that OpenSSL uses them on this build.

<Diagram name="erlang-libraries/uth-crypto" caption="A crypto call goes from Elixir into C code, on a dirty scheduler thread, and then to the CPU." />

*Sources:* we measured on Erlang/OTP 29 with `:timer.tc/1`, `/proc/cpuinfo`, and `/proc/self/task`. The throughput depends on the CPU.

</UnderTheHood>

## :digraph

Directed graphs with algorithms for shortest paths and cycles:

```elixir
digraph = :digraph.new()
[v0, v1, v2] = for c <- [{0.0, 0.0}, {1.0, 0.0}, {1.0, 1.0}], do: :digraph.add_vertex(digraph, c)
:digraph.add_edge(digraph, v0, v1)
:digraph.add_edge(digraph, v1, v2)
:digraph.get_short_path(digraph, v0, v2)
#=> [{0.0, 0.0}, {1.0, 0.0}, {1.0, 1.0}]
```

<Diagram name="erlang-libraries/digraph" caption="Three vertices, two edges, and one shortest path." />

`:digraph` changes the graph **in place**. This is possible because it uses ETS tables.

## ETS

`:ets` stores large data in memory and `:dets` stores it on disk. A table holds tuples. It works as a small database, a key-value store, or a cache. By default, tables are **protected**: only the owner process can write and any process can read. The functions change the table as a side effect.

<Diagram name="erlang-libraries/ets" caption="Protected: one writer and many readers." />

```elixir
table = :ets.new(:ets_test, [])
:ets.insert(table, {"China", 1_374_000_000})
:ets.insert(table, {"India", 1_284_000_000})
```

<UnderTheHood>

**Where an ETS table lives.** The table is not on the heap of any process. We inserted 1,000,000 `{integer, string}` tuples. The heap of the owner process measured 2,585 words, and `:erlang.memory(:ets)` had grown by 104 MB. An insert copies the tuple into the table. A lookup copies the value back into the calling process: a lookup of a list with 10,000 elements copied 20,003 words (28 microseconds), and a small value took less than a microsecond. ETS is good for many small values that you read often. The cost grows with the size of the value that you read.

<Diagram name="erlang-libraries/uth-ets" caption="ETS data is outside every process heap. A write copies data out and a read copies data in." />

*Sources:* we measured with `:ets.info/2`, `:erlang.memory/1`, `:erts_debug.flat_size/1`, and `Process.info/2` on Erlang/OTP 29.

</UnderTheHood>

## :math, :queue, :rand, :zip, and :zlib

`:math` covers trigonometry, exponentials, and logarithms (`:math.sin/1`, `:math.exp/1`, `:math.log/1`).

`:queue` is an efficient double-ended FIFO queue:

<Diagram name="erlang-libraries/queue" caption="First in, first out. A take from an empty queue returns {:empty, queue}." />

```elixir
q = :queue.new
q = :queue.in("A", q)
q = :queue.in("B", q)
{value, q} = :queue.out(q)   # value = {:value, "A"}
```

`:rand` gives random values (`:rand.uniform/0`, `:rand.uniform(6)`) and seeding (`:rand.seed/2`). `:zip` reads and writes ZIP files. `:zlib` does zlib compression (`:zlib.compress/1` and `:zlib.uncompress/1`).

<UnderTheHood>

**What a queue is made of.** A queue that we built with `:queue.in/2` looked like `{[5, 4, 3, 2], [1]}`. One list is for the rear, in reverse order, and one list is for the front. To add an element, the VM adds one cons to the rear list. To take an element, the VM takes it from the front. When the front is empty, the VM fills it again from the rear and reverses the order.

After one removal from that queue, it looked like `{[5, 4], [2, 3]}`. The VM split the rear list and did not move it whole. In both cases, the VM reverses each element only occasionally. For this reason, the Erlang docs give both operations as amortized O(1). The docs call the representation opaque, so this is an implementation detail. Do not depend on it.

<Diagram name="erlang-libraries/uth-queue" caption="A queue is two lists. The VM reverses the rear into the front only when the front is empty." />

*Sources:* we printed the values on Erlang/OTP 29. The complexity is from the [`queue` docs](https://www.erlang.org/doc/apps/stdlib/queue.html).

</UnderTheHood>

## Learning Erlang

The guide points to Erlang Syntax: A Crash Course (Elixir next to Erlang), the Erlang course on erlang.org, and *Learn You Some Erlang for Great Good!*.

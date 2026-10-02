# Lists and tuples

Source: [Elixir guide, Lists and tuples](https://elixir.hexdocs.pm/lists-and-tuples.html).

## Linked lists

Square brackets, any types inside. `++` concatenates, `--` subtracts. Neither changes its input:
they return a new list, because Elixir data is *immutable*.

```elixir
[1, 2, 3] ++ [4, 5, 6]                    #=> [1, 2, 3, 4, 5, 6]
[1, true, 2, false, 3, true] -- [true, false]   #=> [1, 2, 3, true]
```

`hd/1` is the first element (the head), `tl/1` is the rest (the tail). Both fail on an empty list:

```elixir
list = [1, 2, 3]
hd(list)   #=> 1
tl(list)   #=> [2, 3]
hd([])     #=> ** (ArgumentError) argument error
```

A list of printable ASCII numbers prints as a *charlist*: `[104, 101, 108, 108, 111]` shows as
`~c"hello"`. It is still a list of integers. See
[Binaries, strings, and charlists](./binaries-strings-and-charlists).

## Tuples

Curly brackets, any types inside, stored contiguously. Indexes start at 0.

```elixir
tuple = {:ok, "hello"}
tuple_size(tuple)              #=> 2
elem(tuple, 1)                 #=> "hello"
put_elem(tuple, 1, "world")    #=> {:ok, "world"}
tuple                          #=> {:ok, "hello"}   (unchanged)
```

## Lists or tuples?

The storage layout decides which operations are cheap.

<Diagram name="lists-and-tuples/list-vs-tuple" caption="A list must be walked cell by cell. A tuple jumps straight to a slot." />

- **List:** length is *linear* (walk every cell). Prepending is cheap, appending is not.
- **Tuple:** size and `elem/2` are *constant*. Changing or adding an element is expensive, because it
  builds a new tuple.

```elixir
list = [1, 2, 3]
[0] ++ list   # fast: traverses only [0]
list ++ [4]   # slow: traverses all of list
```

<Diagram name="lists-and-tuples/prepend-append" caption="Prepending reuses the whole existing list. Appending has to rebuild every cell." />

Even when a tuple is "updated", the elements aren't copied. Old and new tuple share every entry
except the replaced one. This holds for most Elixir data structures and is only safe because data is
immutable.

<Diagram name="lists-and-tuples/shared" caption="put_elem(tuple, 2, :e): the new tuple shares :a, :b and :d with the old one." />

### Which to pick

- **List** when the number of elements varies: `String.split("hello world")` returns `["hello", "world"]`.
- **Tuple** when the size is fixed: `String.split_at("hello world", 3)` returns `{"hel", "lo world"}`.
- **Tagged tuple** for succeed-or-fail results: `File.read/1` gives `{:ok, contents}` or
  `{:error, :enoent}`. Pattern matching handles both.

<UnderTheHood>

**Where the data lives.** Every process has its own heap: an array of *words*, 8 bytes each on a 64-bit machine. A small integer or an atom fits in one word. A list cell is two words: the element (or a pointer to it) and a pointer to the rest of the list. A tuple is one header word that holds its size, then one word per element.

<Diagram name="lists-and-tuples/heap-words" caption="The same data as words on the heap, and the one instruction that reads each." />

**What the CPU does.** The compiler turns `[head | _]` into `get_hd` and a tuple pattern into `get_tuple_element`: each loads one word. On x86-64 and aarch64 the VM translates those instructions to native machine code when a module loads ([BeamAsm](https://www.erlang.org/doc/apps/erts/beamasm.html); `:erlang.system_info(:emu_flavor)` is `:jit` here). `length/1` has to follow the pointer in every cell, so it costs time in proportion to the list. A tuple's size sits in its header, so checking it, as `test_arity` does, walks nothing.

**Why `++` copies and prepending doesn't.** `[x | list]` allocates one new cell (the compiler reserves two words with `test_heap`, then `put_list`) that points at the old list, so nothing is copied. `list ++ [4]` has to build new cells that end in `[4]`, so it copies every cell of `list`. `put_elem/3` builds a new tuple of `n + 1` words, and elements are shared, not copied.

```elixir
l = Enum.to_list(1..1000)
:erts_debug.flat_size(l)             #=> 2000  words: 2 per cell
:erts_debug.size([l, [0 | l]])       #=> 2006  prepend: 6 words, l is shared
:erts_debug.size([l, l ++ [4]])      #=> 4006  append: l is copied
```

`size/1` counts shared parts once and `flat_size/1` counts every part. `:erts_debug` is a debugging module, not a stable API. Numbers were measured on a 64-bit machine with Erlang/OTP 29 and will differ on other builds.

This sharing only holds inside one process. A term sent as a message, or stored in an ETS table, is copied without it ("loss of sharing" in the [Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html)).

*Sources:* the [Erlang memory guide](https://www.erlang.org/doc/system/memory.html) for the word as the unit. Its table of sizes is from OTP 19 and is off by a word for tuples and lists, so the sizes above come from measurement. Instructions were read with `:beam_disasm`.

</UnderTheHood>

## Size or length?

The name tells you the cost. `size` is constant time, `length` is linear (both start with "l").

| Function | Counts | Cost |
|---|---|---|
| `tuple_size/1` | tuple elements | constant |
| `byte_size/1` | bytes in a string | constant |
| `length/1` | list elements | linear |
| `String.length/1` | graphemes in a string | linear |

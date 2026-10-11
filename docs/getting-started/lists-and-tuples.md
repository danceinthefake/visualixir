# Lists and tuples

Source: [Elixir guide, Lists and tuples](https://elixir.hexdocs.pm/lists-and-tuples.html).

## Linked lists

A list has square brackets and can hold any types. `++` concatenates lists and `--` subtracts them. Neither changes its input. They return a new list, because Elixir data is *immutable*.

```elixir
[1, 2, 3] ++ [4, 5, 6]                    #=> [1, 2, 3, 4, 5, 6]
[1, true, 2, false, 3, true] -- [true, false]   #=> [1, 2, 3, true]
```

`hd/1` returns the first element (the head). `tl/1` returns the rest (the tail). Both fail on an empty list:

```elixir
list = [1, 2, 3]
hd(list)   #=> 1
tl(list)   #=> [2, 3]
hd([])     #=> ** (ArgumentError) argument error
```

A list of printable ASCII numbers prints as a *charlist*: `[104, 101, 108, 108, 111]` shows as `~c"hello"`. It is still a list of integers. See [Binaries, strings, and charlists](./binaries-strings-and-charlists).

## Tuples

A tuple has curly brackets and can hold any types. The elements are stored one after the other in memory. Indexes start at 0.

```elixir
tuple = {:ok, "hello"}
tuple_size(tuple)              #=> 2
elem(tuple, 1)                 #=> "hello"
put_elem(tuple, 1, "world")    #=> {:ok, "world"}
tuple                          #=> {:ok, "hello"}   (unchanged)
```

## Lists or tuples?

The storage layout decides which operations are cheap.

<Diagram name="lists-and-tuples/list-vs-tuple" caption="The VM must walk a list cell by cell. A tuple goes straight to a slot." />

- **List:** the length is *linear*, because the VM walks every cell. Prepending is cheap and appending is not.
- **Tuple:** the size and `elem/2` are *constant*. To change or add an element is expensive, because the VM builds a new tuple.

```elixir
list = [1, 2, 3]
[0] ++ list   # fast: walks only [0]
list ++ [4]   # slow: walks all of list
```

<Diagram name="lists-and-tuples/prepend-append" caption="Prepending reuses the whole existing list. Appending must rebuild every cell." />

When you "update" a tuple, the VM does not copy the elements. The old tuple and the new tuple share every entry except the replaced entry. This is true for most Elixir data structures, and it is safe only because data is immutable.

<Diagram name="lists-and-tuples/shared" caption="put_elem(tuple, 2, :e): the new tuple shares :a, :b, and :d with the old tuple." />

### Which one to use

- Use a **list** when the number of elements changes: `String.split("hello world")` returns `["hello", "world"]`.
- Use a **tuple** when the size is fixed: `String.split_at("hello world", 3)` returns `{"hel", "lo world"}`.
- Use a **tagged tuple** for results that can succeed or fail: `File.read/1` gives `{:ok, contents}` or `{:error, :enoent}`. Pattern matching handles both.

<UnderTheHood>

**In short:** a list cell is two words. A tuple is one word for each element plus a header. Memory comes from the kernel in pages, and the CPU reads it through small fast caches.

**Where the data lives.** Every process has its own heap. The heap is an array of *words*, 8 bytes each on a 64-bit machine. A small integer or an atom fits in one word. A list cell is two words: the element (or a pointer to it) and a pointer to the rest of the list. A tuple is one header word that holds its size, and then one word for each element.

<Diagram name="lists-and-tuples/uth-heap-words" caption="The same data as words on the heap, and the one instruction that reads each." />

**What the CPU does.** The compiler turns `[head | _]` into `get_hd` and a tuple pattern into `get_tuple_element`. Each of these instructions loads one word. On x86-64 and aarch64, the VM translates those instructions to native machine code when a module loads ([BeamAsm](https://www.erlang.org/doc/apps/erts/beamasm.html). Here, `:erlang.system_info(:emu_flavor)` is `:jit`). `length/1` must follow the pointer in every cell, so its time grows with the size of the list. The size of a tuple is in its header, so a check of the size, as `test_arity` does it, walks nothing.

**Why `++` copies and prepending does not.** `[x | list]` allocates one new cell (the compiler reserves two words with `test_heap`, then `put_list`) that points to the old list, so the VM copies nothing. `list ++ [4]` must build new cells that end in `[4]`, so it copies every cell of `list`. `put_elem/3` builds a new tuple of `n + 1` words, and the VM shares the elements and does not copy them.

```elixir
l = Enum.to_list(1..1000)
:erts_debug.flat_size(l)             #=> 2000  words: 2 per cell
:erts_debug.size([l, [0 | l]])       #=> 2006  prepend: 6 words, l is shared
:erts_debug.size([l, l ++ [4]])      #=> 4006  append: l is copied
```

`size/1` counts shared parts once and `flat_size/1` counts every part. `:erts_debug` is a debugging module and not a stable API. We measured the numbers on a 64-bit machine with Erlang/OTP 29. They will be different on other builds.

This sharing holds only inside one process. The VM copies a term that it sends as a message, or stores in an ETS table, without the sharing ("loss of sharing" in the [Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html)).

**Below the VM: the kernel.** The heap is ordinary memory that the VM asks the operating system for. We built a list of 4 million elements. `strace` showed that the VM made 67 requests of 1 MiB or more to the Linux kernel (`mmap`, in chunks from 1 to about 82 MiB, 523 MiB in all). The kernel does not give real RAM immediately. Every program works with *virtual addresses*. The kernel keeps *page tables* that map each virtual page of 4096 bytes to a page of physical RAM, and it fills them on demand ([kernel docs](https://docs.kernel.org/admin-guide/mm/concepts.html)).

The first time that a program touches a new page, the kernel assigns a page. This is a *page fault*. A list of 32 MB caused about 25,000 page faults (23,183 and 27,032 in two runs). This is more than the 7,800 or so pages that 32 MB needs. We did not measure the reason. The 523 MiB that the VM requested above suggests that the VM uses much more memory than the finished list while it builds the list.

**Below the VM: the hardware.** `get_hd` ends up as a *load instruction*: read the word at this address. The CPU translates the address with the page tables. Then it looks in its caches before it goes to RAM. On this machine, each core has an L1 cache of 32 KiB and an L2 cache of 512 KiB, and all cores share an L3 cache of 16 MiB (`lscpu`). Data moves between RAM and the caches in *cache lines* of 64 bytes (`getconf LEVEL1_DCACHE_LINESIZE`), so when the CPU reads one word, it also brings the neighbor words.

A list cell is 16 bytes, so a line holds four cells that are side by side, and a small tuple fits in one or two lines. It is cheap to read data that is already in a cache. A miss that goes all the way to RAM is slow ([What Every Programmer Should Know About Memory](https://akkadia.org/drepper/cpumemory.pdf)).

<Diagram name="lists-and-tuples/uth-memory-stack" caption="From hd(list) down to the CPU caches, RAM, and the page tables of the kernel." />

*Sources:* the [Erlang memory guide](https://www.erlang.org/doc/system/memory.html) for the word as the unit. Its table of sizes is from OTP 19 and is wrong by one word for tuples and lists, so the sizes above come from measurement. We read the instructions with `:beam_disasm`. The hardware values come from `lscpu` and `getconf` on an AMD Ryzen 7 5700G. Other CPUs have other sizes.

</UnderTheHood>

## Size or length?

The name shows the cost. `size` is constant time and `length` is linear (both start with "l").

| Function | Counts | Cost |
|---|---|---|
| `tuple_size/1` | tuple elements | constant |
| `byte_size/1` | bytes in a string | constant |
| `length/1` | list elements | linear |
| `String.length/1` | graphemes in a string | linear |

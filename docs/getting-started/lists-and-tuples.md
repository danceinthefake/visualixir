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

## Size or length?

The name tells you the cost. `size` is constant time, `length` is linear (both start with "l").

| Function | Counts | Cost |
|---|---|---|
| `tuple_size/1` | tuple elements | constant |
| `byte_size/1` | bytes in a string | constant |
| `length/1` | list elements | linear |
| `String.length/1` | graphemes in a string | linear |

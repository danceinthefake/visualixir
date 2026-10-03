# Enum cheatsheet

Source: [Elixir cheatsheet, Enum](https://elixir.hexdocs.pm/enum-cheat.html).

A quick reference for `Enum`, the module for working with enumerables. Most examples use this cart:

```elixir
cart = [
  %{fruit: "apple", count: 3},
  %{fruit: "banana", count: 1},
  %{fruit: "orange", count: 6}
]
```

A few use `string =~ part`, which checks that the string on the left contains the part on the right.

## Which function?

Start from what you want back:

<Diagram name="enum-cheat/decision" caption="Find the group by the result you want." />

## Predicates

Functions that answer yes or no.

| Function | Example | Result |
|---|---|---|
| `any?(enum, fun)` | `Enum.any?(cart, & &1.fruit == "orange")` | `true` |
| | `Enum.any?(cart, & &1.fruit == "pear")` | `false` |
| `all?(enum, fun)` | `Enum.all?(cart, & &1.count > 0)` | `true` |
| | `Enum.all?(cart, & &1.count > 1)` | `false` |
| `member?(enum, value)` | `Enum.member?(cart, %{fruit: "apple", count: 3})` | `true` |
| `empty?(enum)` | `Enum.empty?([])` | `true` |

`any?` on an empty collection is always `false`. `all?` on an empty collection is always `true`. `item in enum` is the same as `Enum.member?(enum, item)`.

## Filtering

<Diagram name="enum-cheat/filter-reject" caption="filter keeps what matches. reject drops it." />

| Function | Example | Result |
|---|---|---|
| `filter(enum, fun)` | `Enum.filter(cart, &(&1.fruit =~ "o"))` | `[%{fruit: "orange", count: 6}]` |
| | `Enum.filter(cart, &(&1.fruit =~ "e"))` | apple and orange |
| `reject(enum, fun)` | `Enum.reject(cart, &(&1.fruit =~ "o"))` | apple and banana |
| `flat_map(enum, fun)` | `Enum.flat_map(cart, fn item -> if item.count > 1, do: [item.fruit], else: [] end)` | `["apple", "orange"]` |

`flat_map` filters and transforms in one pass: return `[]` to exclude an element. Comprehensions filter too, with a condition (`for item <- cart, item.fruit =~ "e", do: item`) or with a
pattern in the generator (`for %{count: 1, fruit: fruit} <- cart, do: fruit` gives `["banana"]`).

## Mapping

| Function | Example | Result |
|---|---|---|
| `map(enum, fun)` | `Enum.map(cart, & &1.fruit)` | `["apple", "banana", "orange"]` |
| | `Enum.map(cart, fn item -> %{item \| count: item.count + 10} end)` | counts 13, 11, 16 |
| `map_every(enum, nth, fun)` | `Enum.map_every(cart, 2, fn item -> %{item \| count: item.count + 10} end)` | counts 13, 1, 16 |

`map_every(…, 2, …)` applies the function to the 1st, 3rd, 5th… element. With a comprehension: `for item <- cart, do: item.fruit`, and filter plus map at once with `for item <- cart, item.fruit =~ "e", do: item.fruit`
(`["apple", "orange"]`).

## Side effects

| Function | Example | Result |
|---|---|---|
| `each(enum, fun)` | `Enum.each(cart, &IO.puts(&1.fruit))` | prints the three names, returns `:ok` |

`each` is used **only** for side effects.

## Accumulating

<Diagram name="enum-cheat/accumulate" caption="One list of counts, four ways to accumulate." />

| Function | Example | Result |
|---|---|---|
| `reduce(enum, acc, fun)` | `Enum.reduce(cart, 0, fn item, acc -> item.count + acc end)` | `10` |
| `map_reduce(enum, acc, fun)` | `Enum.map_reduce(cart, 0, fn item, acc -> {item.fruit, item.count + acc} end)` | `{["apple", "banana", "orange"], 10}` |
| `scan(enum, acc, fun)` | `Enum.scan(cart, 0, fn item, acc -> item.count + acc end)` | `[3, 4, 10]` |
| `reduce_while(enum, acc, fun)` | halt with `{:halt, acc}` at `"orange"`, otherwise `{:cont, item.count + acc}` | `4` |

Comprehensions can reduce too: `for item <- cart, reduce: 0 do acc -> item.count + acc end` gives `10`, and with a filter (`item.fruit =~ "e"`) gives `9`.

## Aggregations

| Function | Example | Result |
|---|---|---|
| `count(enum)` | `Enum.count(cart)` | `3` |
| `count(enum, fun)` | `Enum.count(cart, &(&1.fruit =~ "e"))` | `2` |
| `frequencies(enum)` | `Enum.frequencies(["apple", "banana", "orange", "apple"])` | `%{"apple" => 2, "banana" => 1, "orange" => 1}` |
| `frequencies_by(enum, key_fun)` | `Enum.frequencies_by(cart, &String.last(&1.fruit))` | `%{"a" => 1, "e" => 2}` |
| `sum(enum)` | `cart \|> Enum.map(& &1.count) \|> Enum.sum()` | `10` |
| `sum_by(enum, mapper)` | `Enum.sum_by(cart, & &1.count)` | `10` |
| `product(enum)` | `cart \|> Enum.map(& &1.count) \|> Enum.product()` | `18` |
| `product_by(enum, mapper)` | `Enum.product_by(cart, & &1.count)` | `18` |

Prefer `sum_by/2` and `product_by/2`: one pass instead of two. `Enum.count_until/2,3` counts up to a limit.

## Sorting

| Function | Example | Result |
|---|---|---|
| `sort(enum, sorter \\ :asc)` | `cart \|> Enum.map(& &1.fruit) \|> Enum.sort()` | apple, banana, orange |
| | `… \|> Enum.sort(:desc)` | orange, banana, apple |
| `sort_by(enum, mapper, sorter \\ :asc)` | `Enum.sort_by(cart, & &1.count)` | banana (1), apple (3), orange (6) |
| | `Enum.sort_by(cart, & &1.count, :desc)` | orange, apple, banana |
| `min(enum)` / `max(enum)` | `cart \|> Enum.map(& &1.count) \|> Enum.min()` | `1` (`max`: `6`) |
| `min_by(enum, mapper)` | `Enum.min_by(cart, & &1.count)` | `%{fruit: "banana", count: 1}` |
| `max_by(enum, mapper)` | `Enum.max_by(cart, & &1.count)` | `%{fruit: "orange", count: 6}` |

When sorting or comparing **structs**, pass a module as the sorter (`Enum.sort/2`, `sort_by/3`, `min/2`, `min_by/3`, `max/2`, `max_by/3`).

## Concatenating and flattening

<Diagram name="enum-cheat/flat-map" caption="flat_map is map followed by a one-level flatten." />

| Function | Example | Result |
|---|---|---|
| `concat(enums)` | `Enum.concat([[1, 2, 3], [4, 5, 6], [7, 8, 9]])` | `[1, 2, 3, 4, 5, 6, 7, 8, 9]` |
| `concat(left, right)` | `Enum.concat([1, 2, 3], [4, 5, 6])` | `[1, 2, 3, 4, 5, 6]` |
| `flat_map(enum, fun)` | `Enum.flat_map(cart, fn item -> List.duplicate(item.fruit, item.count) end)` | apple ×3, banana, orange ×6 |
| `flat_map_reduce(enum, acc, fun)` | same, returning `{list, acc + item.count}` | `{that list, 10}` |

Two generators in a comprehension flatten too: `for item <- cart, fruit <- List.duplicate(item.fruit, item.count), do: fruit`.

## Conversion

| Function | Example | Result |
|---|---|---|
| `into(enum, collectable)` | `Enum.into([{"apple", 3}, {"banana", 1}, {"orange", 6}], %{})` | `%{"apple" => 3, "banana" => 1, "orange" => 6}` |
| `into(enum, collectable, transform)` | `Enum.into(cart, %{}, fn item -> {item.fruit, item.count} end)` | the same map |
| `to_list(enum)` | `Enum.to_list(1..5)` | `[1, 2, 3, 4, 5]` |

The comprehension form is `for item <- cart, into: %{}, do: {item.fruit, item.count}`.

<Diagram name="enum-cheat/for-equivalents" caption="Every comprehension option has an Enum function." />

## Duplicates and uniques

<Diagram name="enum-cheat/dedup-uniq" caption="dedup only sees neighbours. uniq sees everything." />

| Function | Example | Result |
|---|---|---|
| `dedup(enum)` | `Enum.dedup([1, 2, 2, 3, 3, 3, 1, 2, 3])` | `[1, 2, 3, 1, 2, 3]` |
| `dedup_by(enum, fun)` | `Enum.dedup_by(cart, & &1.fruit =~ "a")` | just the apple |
| | `Enum.dedup_by(cart, & &1.count < 5)` | apple and orange |
| `uniq(enum)` | `Enum.uniq([1, 2, 2, 3, 3, 3, 1, 2, 3])` | `[1, 2, 3]` |
| `uniq_by(enum, fun)` | `Enum.uniq_by(cart, &String.last(&1.fruit))` | apple and banana |

Comprehensions support `uniq: true`.

## Indexing

| Function | Example | Result |
|---|---|---|
| `at(enum, index, default \\ nil)` | `Enum.at(cart, 0)` | the apple map |
| | `Enum.at(cart, 10)` / `Enum.at(cart, 10, :none)` | `nil` / `:none` |
| `fetch(enum, index)` | `Enum.fetch(cart, 0)` / `Enum.fetch(cart, 10)` | `{:ok, apple map}` / `:error` |
| `fetch!(enum, index)` | `Enum.fetch!(cart, 10)` | raises `Enum.OutOfBoundsError` |
| `with_index(enum)` | `Enum.with_index(cart)` | `[{apple map, 0}, {banana map, 1}, {orange map, 2}]` |
| `with_index(enum, fun)` | `Enum.with_index(cart, fn item, index -> {item.fruit, index} end)` | `[{"apple", 0}, {"banana", 1}, {"orange", 2}]` |

Indexing into a list in a loop is discouraged: lists are linked lists.

<UnderTheHood>

**Why indexing a list in a loop is slow.** A list is linked cells, so `Enum.at(list, n)` has to follow `n` pointers from the front. On a list of a million integers (about 16 MB of cells), `Enum.at(list, 0)` took 2 to 3 microseconds and `Enum.at(list, 999_999)` took about 2 milliseconds (1.7 and 2.4 ms in two runs). `elem(tuple, 999_999)` on the same data as a tuple took under a microsecond, one load at a fixed offset. Doing the slow lookup once per element in a loop makes the whole loop quadratic.

<Diagram name="enum-cheat/uth-at" caption="Indexing a list walks its cells. Indexing a tuple is one load." />

*Sources:* measured with `:timer.tc/1` on Erlang/OTP 29. Timings vary by machine.

</UnderTheHood>

## Finding

| Function | Example | Result |
|---|---|---|
| `find(enum, default \\ nil, fun)` | `Enum.find(cart, &(&1.fruit =~ "o"))` | the orange map |
| | `Enum.find(cart, &(&1.fruit =~ "y"))` / with default `:none` | `nil` / `:none` |
| `find_index(enum, fun)` | `Enum.find_index(cart, &(&1.fruit =~ "o"))` | `2` (`nil` if none) |
| `find_value(enum, default \\ nil, fun)` | `Enum.find_value(cart, fn item -> if item.count == 1, do: item.fruit end)` | `"banana"` |

`find_value` returns the first truthy result of the function, not the element.

## Grouping

<Diagram name="enum-cheat/group-by" caption="The key function decides the group." />

| Function | Example | Result |
|---|---|---|
| `group_by(enum, key_fun)` | `Enum.group_by(cart, &String.last(&1.fruit))` | `%{"a" => [banana map], "e" => [apple map, orange map]}` |
| `group_by(enum, key_fun, value_fun)` | `Enum.group_by(cart, &String.last(&1.fruit), & &1.fruit)` | `%{"a" => ["banana"], "e" => ["apple", "orange"]}` |

## Joining and interspersing

| Function | Example | Result |
|---|---|---|
| `join(enum, joiner \\ "")` | `Enum.join(["apple", "banana", "orange"], ", ")` | `"apple, banana, orange"` |
| `map_join(enum, joiner \\ "", mapper)` | `Enum.map_join(cart, ", ", & &1.fruit)` | `"apple, banana, orange"` |
| `intersperse(enum, separator \\ "")` | `Enum.intersperse(["apple", "banana", "orange"], ", ")` | `["apple", ", ", "banana", ", ", "orange"]` |
| `map_intersperse(enum, separator \\ "", mapper)` | `Enum.map_intersperse(cart, ", ", & &1.fruit)` | the same list |

## Slicing

| Function | Example | Result |
|---|---|---|
| `slice(enum, index_range)` | `Enum.slice(cart, 0..1)` | apple, banana |
| | `Enum.slice(cart, -2..-1)` | banana, orange (negative counts from the back) |
| `slice(enum, start_index, amount)` | `Enum.slice(cart, 1, 2)` | banana, orange |
| `slide(enum, range_or_index, insertion_index)` | `Enum.slide(fruits, 2, 0)` | `["grape", "apple", "banana", "orange", "pear"]` |
| | `Enum.slide(fruits, 1..3, 4)` | `["apple", "pear", "banana", "grape", "orange"]` |

Those slide examples use `fruits = ["apple", "banana", "grape", "orange", "pear"]`.

## Reversing

| Function | Example | Result |
|---|---|---|
| `reverse(enum)` | `Enum.reverse(cart)` | orange, banana, apple |
| `reverse(enum, tail)` | `Enum.reverse(cart, [:this_will_be, :the_tail])` | the reversed cart, then `:this_will_be, :the_tail` |
| `reverse_slice(enum, start_index, count)` | `Enum.reverse_slice(cart, 1, 2)` | apple, orange, banana |

## Splitting

<Diagram name="enum-cheat/splitting" caption="split_while stops early. split_with checks everything." />

| Function | Example | Result |
|---|---|---|
| `split(enum, amount)` | `Enum.split(cart, 1)` | `{[apple], [banana, orange]}` |
| | `Enum.split(cart, -1)` | `{[apple, banana], [orange]}` |
| `split_while(enum, fun)` | `Enum.split_while(cart, &(&1.fruit =~ "e"))` | `{[apple], [banana, orange]}` |
| `split_with(enum, fun)` | `Enum.split_with(cart, &(&1.fruit =~ "e"))` | `{[apple, orange], [banana]}` |

### Drop and take

| Function | Example | Result |
|---|---|---|
| `drop(enum, amount)` | `Enum.drop(cart, 1)` / `Enum.drop(cart, -1)` | banana, orange / apple, banana |
| `drop_every(enum, nth)` | `Enum.drop_every(cart, 2)` | `[banana map]` |
| `drop_while(enum, fun)` | `Enum.drop_while(cart, &(&1.fruit =~ "e"))` | banana, orange |
| `take(enum, amount)` | `Enum.take(cart, 1)` / `Enum.take(cart, -1)` | `[apple map]` / `[orange map]` |
| `take_every(enum, nth)` | `Enum.take_every(cart, 2)` | apple, orange |
| `take_while(enum, fun)` | `Enum.take_while(cart, &(&1.fruit =~ "e"))` | `[apple map]` |

Negative amounts count from the back.

## Random

| Function | Example | Result |
|---|---|---|
| `random(enum)` | `Enum.random(cart)` | one element, different each call |
| `take_random(enum, count)` | `Enum.take_random(cart, 2)` | two elements, different each call |
| `shuffle(enum)` | `Enum.shuffle(cart)` | the cart in a random order |

## Chunking

<Diagram name="enum-cheat/chunk" caption="Fixed-size chunks, sliding windows, or chunks that follow a value." />

| Function | Example | Result |
|---|---|---|
| `chunk_by(enum, fun)` | `Enum.chunk_by(cart, &String.length(&1.fruit))` | `[[apple], [banana, orange]]` |
| `chunk_every(enum, count)` | `Enum.chunk_every(cart, 2)` | `[[apple, banana], [orange]]` |
| `chunk_every(enum, count, step, leftover \\ [])` | `Enum.chunk_every(cart, 2, 2, [:elements, :to_complete])` | `[[apple, banana], [orange, :elements]]` |
| | `Enum.chunk_every(cart, 2, 1, :discard)` | `[[apple, banana], [banana, orange]]` |

See `Enum.chunk_while/4` for custom chunking.

## Zipping

<Diagram name="enum-cheat/zip" caption="zip pairs elements by position. unzip splits them again." />

With `fruits = ["apple", "banana", "orange"]` and `counts = [3, 1, 6]`:

| Function | Example | Result |
|---|---|---|
| `zip(enum1, enum2)` | `Enum.zip(fruits, counts)` | `[{"apple", 3}, {"banana", 1}, {"orange", 6}]` |
| `zip_with(enum1, enum2, fun)` | `Enum.zip_with(fruits, counts, fn fruit, count -> %{fruit: fruit, count: count} end)` | the cart |
| `zip_reduce(left, right, acc, fun)` | price is `count * 2` if `fruit =~ "e"`, else `count`, summed from `0` | `19` |
| `unzip(list)` | `cart \|> Enum.map(&{&1.fruit, &1.count}) \|> Enum.unzip()` | `{["apple", "banana", "orange"], [3, 1, 6]}` |

`Enum.zip/1`, `zip_with/2` and `zip_reduce/3` zip many collections at once.

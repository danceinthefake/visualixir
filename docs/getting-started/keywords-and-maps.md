# Keyword lists and maps

Source: [Elixir guide, Keyword lists and maps](https://elixir.hexdocs.pm/keywords-and-maps.html).

Elixir has two associative structures: keyword lists and maps.

<Diagram name="keywords-and-maps/keyword-vs-map" caption="A keyword list is a list of tuples with two elements. A map is a real key-value store." />

## Keyword lists

Keyword lists are mostly for options that you pass to functions. `String.split("1  2  3  4", " ", parts: 3, trim: true)` returns `["1", "2", " 3  4"]`. When a keyword list is the **last argument**, the brackets are optional.

A keyword list is a list of `{atom, value}` tuples, so `[{:parts, 3}, {:trim, true}]` is the same as `[parts: 3, trim: true]`. Three properties are important:

- The keys must be atoms.
- The keys keep the order that you wrote.
- The keys can repeat.

```elixir
list = [a: 1, b: 2]
list ++ [c: 3]      #=> [a: 1, b: 2, c: 3]
[a: 0] ++ list      #=> [a: 0, a: 1, b: 2]
list[:a]            #=> 1   (first match, via the Access module)
```

Keyword lists are lists, so lookups are linear. **Do not pattern match on keyword lists.** The number and the order of the items must match exactly, so `[a: a] = [a: 1, b: 2]` fails.

### `do` blocks are keywords

`if true do "a" else "b" end` is `if(true, do: "a", else: "b")`. The `do` and `else` blocks are syntax sugar over a keyword list. This keeps the language small.

## Maps

`%{}` builds a map. The keys can be of any type, and the order is not promised.

```elixir
map = %{:a => 1, 2 => :b}
map[:a]   #=> 1
map[2]    #=> :b
map[:c]   #=> nil
```

Maps are made for pattern matching. A pattern matches any map that **contains** the keys of the pattern, so `%{}` matches every map.

<Diagram name="keywords-and-maps/map-match" caption="A map pattern needs its keys to exist. Extra keys in the value are ignored." />

```elixir
%{:a => a} = %{:a => 1, 2 => :b}   # a = 1
%{:c => c} = %{:a => 1, 2 => :b}   #=> ** (MatchError)
```

`Map.get/2`, `Map.put/3`, and `Map.to_list/1` cover the usual operations.

<UnderTheHood>

**In memory.** We measured with `:erts_debug.flat_size/1`. A keyword list of 5 entries took 25 words, and the map with the same data took 14 words. Each keyword entry is a list cell (2 words) and a tuple with two elements (3 words). These are separate objects that the CPU must follow one by one. A small map keeps its keys in one tuple and its values in another tuple, as the anti-patterns chapter on structs with 32 fields describes. The memory guide says that a small map has up to 32 keys, and that a larger map uses a hash tree ([memory guide](https://www.erlang.org/doc/system/memory.html)). The numbers show the change: 32 keys took 68 words and 33 keys took 125 words.

<Diagram name="keywords-and-maps/uth-map-sizes" caption="The same data as a keyword list and as maps of growing size, in words." />

To look up a key in a keyword list, the VM walks the cells until it finds the key, as the chapter says. In a map, the keys are together in one tuple.

*Sources:* we measured the sizes on a 64-bit Erlang/OTP 29. The limit of 32 keys is from the [memory guide](https://www.erlang.org/doc/system/memory.html).

</UnderTheHood>

## Maps with predefined keys

When you know the shape, use atom keys. `%{name: "John", age: 23}` is the same as `%{:name => "John", :age => 23}`. Two strict forms are then available:

```elixir
map.name             #=> "John"
map.agee             #=> ** (KeyError) key :agee not found
%{map | name: "Mary"}   #=> %{name: "Mary", age: 23}
%{map | agee: 27}       #=> ** (KeyError)
```

| Read | Missing key |
|---|---|
| `map[:key]` | `nil` |
| `map.key` | `KeyError` |
| `%{map \| key: v}` | `KeyError` |

An early error finds typos and mistakes fast. For this reason, Elixir developers prefer `map.key` and pattern matching to the `Map` functions. [Structs](./structs) build on this.

## Nested data

`get_in`, `put_in`, and `update_in` reach into nested structures and keep immutability:

```elixir
users = [
  john: %{name: "John", age: 27, languages: ["Erlang", "Ruby", "Elixir"]},
  mary: %{name: "Mary", age: 29, languages: ["Elixir", "F#", "Clojure"]}
]

users[:john].age                      #=> 27
users = put_in(users[:john].age, 31)
users = update_in(users[:mary].languages, fn l -> List.delete(l, "Clojure") end)
```

<Diagram name="keywords-and-maps/nested" caption="users[:john].age goes from the keyword list, into the map of John, to the age." />

## Which one to use?

<Diagram name="keywords-and-maps/choose" caption="Use keyword lists for options. Use maps for everything else." />

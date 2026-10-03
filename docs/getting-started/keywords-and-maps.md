# Keyword lists and maps

Source: [Elixir guide, Keyword lists and maps](https://elixir.hexdocs.pm/keywords-and-maps.html).

Elixir has two associative structures: keyword lists and maps.

<Diagram name="keywords-and-maps/keyword-vs-map" caption="A keyword list is a list of two-element tuples. A map is a real key-value store." />

## Keyword lists

Mostly for passing options to functions. `String.split("1  2  3  4", " ", parts: 3, trim: true)`
returns `["1", "2", " 3  4"]`. When a keyword list is the **last argument**, the brackets are optional.

A keyword list is just a list of `{atom, value}` tuples, so `[{:parts, 3}, {:trim, true}]` equals
`[parts: 3, trim: true]`. Three properties matter:

- keys must be atoms
- keys keep the order you wrote them
- keys can repeat

```elixir
list = [a: 1, b: 2]
list ++ [c: 3]      #=> [a: 1, b: 2, c: 3]
[a: 0] ++ list      #=> [a: 0, a: 1, b: 2]
list[:a]            #=> 1   (first match, via the Access module)
```

Because they are lists, lookups are linear. And **don't pattern match on keyword lists**: the number
and order of items must match exactly, so `[a: a] = [a: 1, b: 2]` fails.

### `do` blocks are keywords

`if true do "a" else "b" end` is `if(true, do: "a", else: "b")`. The `do`/`else` blocks are
syntax sugar over a keyword list, which keeps the language small.

## Maps

`%{}` builds a map. Keys can be any type, and there's no promised ordering.

```elixir
map = %{:a => 1, 2 => :b}
map[:a]   #=> 1
map[2]    #=> :b
map[:c]   #=> nil
```

Maps are made for pattern matching. A pattern matches any map that **contains** the pattern's keys,
so `%{}` matches every map.

<Diagram name="keywords-and-maps/map-match" caption="A map pattern needs its keys to exist. Extra keys in the value are ignored." />

```elixir
%{:a => a} = %{:a => 1, 2 => :b}   # a = 1
%{:c => c} = %{:a => 1, 2 => :b}   #=> ** (MatchError)
```

`Map.get/2`, `Map.put/3` and `Map.to_list/1` cover the usual operations.

<UnderTheHood>

**In memory.** Measured with `:erts_debug.flat_size/1`, a keyword list of 5 entries took 25 words and the map with the same data took 14. Each keyword entry is a list cell (2 words) plus a two-element tuple (3 words), separate objects the CPU has to follow one by one. A small map keeps its keys in one tuple and its values in another, as the anti-patterns chapter on 32-field structs describes. The memory guide says a small map has up to 32 keys and a larger one uses a hash tree ([memory guide](https://www.erlang.org/doc/system/memory.html)). The numbers show the switch: 32 keys took 68 words and 33 keys took 125.

<Diagram name="keywords-and-maps/uth-map-sizes" caption="The same data as a keyword list and as maps of growing size, in words." />

Looking a key up in a keyword list means walking its cells until you find it, as the chapter says. In a map the keys sit together in one tuple.

*Sources:* sizes measured on a 64-bit Erlang/OTP 29. The 32-key limit is from the [memory guide](https://www.erlang.org/doc/system/memory.html).

</UnderTheHood>

## Maps with predefined keys

When the shape is known, use atom keys. `%{name: "John", age: 23}` is the same as
`%{:name => "John", :age => 23}`. Then two strict forms are available:

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

Raising early catches typos and mistakes fast. Elixir developers prefer `map.key` and pattern
matching over the `Map` functions for that reason. [Structs](./structs) build on this.

## Nested data

`get_in`, `put_in` and `update_in` reach into nested structures without losing immutability:

```elixir
users = [
  john: %{name: "John", age: 27, languages: ["Erlang", "Ruby", "Elixir"]},
  mary: %{name: "Mary", age: 29, languages: ["Elixir", "F#", "Clojure"]}
]

users[:john].age                      #=> 27
users = put_in(users[:john].age, 31)
users = update_in(users[:mary].languages, fn l -> List.delete(l, "Clojure") end)
```

<Diagram name="keywords-and-maps/nested" caption="users[:john].age walks from the keyword list, into John's map, to the age." />

## Which one?

<Diagram name="keywords-and-maps/choose" caption="Keyword lists for options. Maps for everything else." />

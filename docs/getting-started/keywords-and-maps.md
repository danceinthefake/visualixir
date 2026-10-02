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

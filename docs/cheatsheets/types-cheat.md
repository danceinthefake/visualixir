# Set-theoretic types cheatsheet

Source: [Elixir cheatsheet, Set-theoretic types](https://elixir.hexdocs.pm/types-cheat.html).

A type is a **set of values**. The type language has set operators to combine those sets.

## Set operators

<Diagram name="types-cheat/set-ops" caption="Types combine like sets: or, and, and not." />

| Operator | Syntax | Meaning |
|---|---|---|
| Union | `type1 or type2` | values in either |
| Intersection | `type1 and type2` | values in both |
| Difference | `type1 and not type2` | values in the first but not the second |
| Negation | `not type` | every value that is not in the type |

## Data types

<Diagram name="types-cheat/hierarchy" caption="The broad types and how they nest." />

### Broad types

`bitstring()`, `binary()`, `empty_list()`, `integer()`, `float()`, `pid()`, `port()`, `reference()`.

`binary()` is a subtype of `bitstring()`.

### Atoms

| Type | Matches |
|---|---|
| `atom()` | all atoms |
| `:ok`, `:error`, `SomeModule` | one individual atom each |

### Functions

| Type | Meaning |
|---|---|
| `function()` | all functions |
| `(-> :ok)` | a zero-arity function returning `:ok` |
| `(integer() -> boolean())` | one argument |
| `(binary(), binary() -> binary())` | two arguments |
| `(integer() -> binary()) and (binary() -> atom())` | multiple clauses |

An intersection of function types describes one function with several clauses:

<Diagram name="types-cheat/fn-clauses" caption="Each clause applies to its own argument type." />

### Maps

| Type | Meaning |
|---|---|
| `map()` | all maps |
| `empty_map()` | the empty map |

**Maps with atom keys**

```elixir
# Only has the keys name and age
%{name: binary(), age: integer()}

# Has the name key and age is optional
%{name: binary(), age: if_set(integer())}

# Has the keys name and age and may have other keys (open map)
%{..., name: binary(), age: integer()}

# Has the key name, may have other keys, but age is not set
%{..., name: binary(), age: not_set()}
```

<Diagram name="types-cheat/map-keys" caption="Which values each map type accepts." />

**Maps with domain keys** (always treated as optional)

```elixir
# Has atom and binary keys
%{atom() => binary(), binary() => binary()}

# ...and may have other keys (open map)
%{..., atom() => binary(), binary() => binary()}
```

**Maps with mixed keys**

```elixir
# atom keys with binary values, but a :root key of type integer
%{atom() => binary(), root: integer()}

# ...and may have other keys
%{..., atom() => binary(), root: integer()}
```

The domain key types are `atom()`, `binary()`, `integer()`, `float()`, `fun()`, `list()`, `map()`, `pid()`, `port()`, `reference()` and `tuple()`.

### Non-empty lists

| Type | Meaning |
|---|---|
| `non_empty_list(elem_type)` | a proper list |
| `non_empty_list(elem_type, tail_type)` | an improper list, as long as `tail_type` does not include lists |

<Diagram name="types-cheat/lists" caption="A proper list ends in []. An improper list ends in something else." />

### Tuples

| Type | Meaning |
|---|---|
| `tuple()` | all tuples |
| `{:ok, binary()}`, `{:error, binary(), term()}`, `{pid(), reference()}` | tuples of exactly n elements |
| `{binary(), binary(), ...}` | tuples of **at least** n elements |

## Additional types for convenience

| Alias | Definition |
|---|---|
| `boolean()` | `true or false` |
| `number()` | `integer() or float()` |
| `list()` | `empty_list() or non_empty_list(term())` |
| `list(a)` | `empty_list() or non_empty_list(a)` |
| `list(a, b)` | `empty_list() or non_empty_list(a, b)` |

# Gradual set-theoretic types

Source: [Elixir reference, Gradual set-theoretic types](https://elixir.hexdocs.pm/gradual-set-theoretic-types.html).

Elixir is incorporating set-theoretic types into the compiler. This page describes the current stage. The type system is:

- **sound:** the types it infers and assigns agree with how the program behaves
- **gradual:** it has a `dynamic()` type for things checked at runtime. But `dynamic()` works as a **range**: `dynamic(integer() or binary())` still reports a violation if none of those types is accepted. Without `dynamic()`, the system behaves as a static one
- **developer friendly:** types are built with set operations: union, intersection and negation

The current milestone **infers** types from existing programs and uses them for type checking, so the compiler finds bugs without changes to your code. User-provided signatures are planned for later.

<Diagram name="gradual-set-theoretic-types/roadmap" caption="Three milestones. The first is the current one." />

## A gentle introduction

Types are written like calls: `integer()`, `list(integer())`. The basic types are `atom()`, `binary()`, `bitstring()`, `empty_list()`, `integer()`, `float()`, `function()`, `map()`, `non_empty_list(elem_type, tail_type)`, `pid()`, `port()`, `reference()` and `tuple()`.

Many can be written more precisely: `:ok` for one atom, `{:ok, integer()}` for a two-element tuple. Three special types: `none()` (the empty set), `term()` (everything) and `dynamic()` (a range).

Compose them with `or`, `and` and `not`. `atom() or integer()` is either. `atom() and integer()` is the empty set, `none()`. A **difference** combines the two: all atoms except `nil` is `atom() and not nil`.
The full syntax is in the [types cheatsheet](../cheatsheets/types-cheat).

## The syntax of data types

Developers meet these types mainly through compiler warnings.

**Broad types** can't name individual elements: `binary()`, `bitstring()`, `integer()`, `float()`, `pid()`, `port()`, `reference()`. `binary()` is a subtype of `bitstring()`, since a binary is a bitstring whose bit count is divisible by 8.

**Atoms:** `atom()` for all, or each literal (`:foo`, `nil`, `true`, `false`) as its own type. `boolean()` is `true or false`.

**Tuples:** `tuple()`, or `{:ok, binary()}`. A trailing `...` means the size is unknown: `{:ok, binary(), ...}` has at least two elements.

**Lists:** `list()` is all proper lists including `[]`. `list(integer())` includes `[]` and `[1, 2, 3]`, but not `[1, "two", 3]`. Internally `list(a)` is `empty_list() or non_empty_list(a)`.

### Improper lists

A second argument to `non_empty_list` is the type of the tail. A proper list's tail is the empty list. If the tail type is not a list, the list is improper. A list tail is merged into the element type.

<Diagram name="gradual-set-theoretic-types/list-equivalences" caption="Different spellings of the same list types." />

### Maps

`map()` is all maps (the same as `%{...}`). Literal syntax:

```elixir
%{name: binary(), age: integer()}       # closed: exactly these keys
%{..., name: binary(), age: integer()}  # open: these keys, other keys allowed
```

`empty_map()` is the empty map (`%{}` also works). **Optional keys** use `if_set/1`: `%{name: binary(), age: if_set(integer())}` certainly has `:name` and may have `:age`. `not_set()` says a key is absent: `%{..., age: not_set()}` is the type
`Map.delete(map, :age)` returns.

**Domain keys** are types instead of atoms (`%{binary() or atom() => integer()}`, or open with `...`). The system tracks only the top of each type: `%{list(integer()) => integer(), list(binary()) => binary()}` is the same as `%{list() => integer() or binary()}`.
Supported domains: `atom()`, `bitstring()`, `binary()`, `integer()`, `float()`, `fun()`, `list()`, `map()`, `pid()`, `port()`, `reference()`, `tuple()`. Domain keys are always optional (you can't store every integer as a key), so fetching one may find nothing.

**Mixed keys** combine both, ordered by increasing precision, like duplicate keys overriding earlier ones at runtime: `%{atom() => binary(), root: integer()}`.

### Functions

`function()` is all of them. An arrow describes one: `(integer() -> boolean())`, `(integer(), integer() -> binary())`. Several clauses mean an **intersection**:

```elixir
def negate(x) when is_integer(x), do: -x
def negate(x) when is_boolean(x), do: not x
```

This function has type `(integer() -> integer())` and also `(boolean() -> boolean())`, so its type is `(integer() -> integer()) and (boolean() -> boolean())`. It belongs to both sets.

<Diagram name="gradual-set-theoretic-types/negate-fn" caption="Two clauses, one intersection." />

Why an intersection and not a union? Take a shirt with green and yellow stripes. It is in the set of shirts with green, and in the set of shirts with yellow. "Green **or** yellow" is true but includes shirts that are only green. "Green **and** yellow" captures both facts. In practice a union of two
functions is not useful, and the compiler points you to the right one.

<Diagram name="gradual-set-theoretic-types/sets" caption="An intersection is more precise than a union." />

## The `dynamic()` type

Existing programs have no type declarations, so Elixir types `negate/1` as `(dynamic() -> dynamic())`. Patterns and guards then refine `x` to `dynamic() and integer()` and `dynamic() and boolean()` in each clause. That makes `dynamic()` a *gradual* type, hence *gradual set-theoretic types*.

Think of `dynamic()` as a range of types. With `var` of type `atom() or integer()`, `Integer.to_string(var)` warns, because it doesn't accept atoms. With `dynamic() and (atom() or integer())` (written `dynamic(atom() or integer())`) there is no warning, since the call works for at least one type.

<Diagram name="gradual-set-theoretic-types/dynamic-range" caption="dynamic() only warns when it is certain the code fails." />

Compared with other gradually typed languages, `dynamic()` here is powerful: it restricts the program via intersections and still warns once failure is certain. If you provide your own non-`dynamic()` types, the system is fully static.

Dynamic types are always at the **root**. `{:ok, dynamic()}` is rewritten to `dynamic({:ok, term()})`. You can't make just part of a tuple, map or list gradual, but `dynamic()` can never sneak into statically typed code.

## Type inference

Inference deduces types at compile time. It has trade-offs:

<Diagram name="gradual-set-theoretic-types/inference" caption="Inference buys checking without annotations and costs on four fronts." />

- **Speed:** inference is often more expensive than checking.
- **Expressiveness:** what can be inferred is a subset of what can be checked.
- **Incremental compilation:** if A depends on B depends on C, a change in C may change B's signature and force A to be recomputed.
- **Cascading errors:** conflicting assumptions can produce less clear messages.

Elixir's inference is **best effort**. It finds bugs where *all* combinations of a type fail, without guaranteeing to find every incompatibility. It infers across the standard library and your dependencies, and treats calls to modules in the **same project** as `dynamic()`. Later, functions with explicit signatures will be checked against them, as in static languages.

### False positives

Inference avoids reporting violations where no runtime error would happen, with two documented exceptions:

- **`for` assumes it runs at least once.** In `for _i <- list do Atom.to_string(x) end` followed by `x + 1`, the checker assumes `x` is an atom. If `list` is empty there's no runtime error, but it still warns. Wrap the loop in `if list != [] do`.
- **Struct update must be statically proven.** `%User{user | name: "John Doe"}` warns unless the type system can prove `user` is a `User`, even if it always is at runtime. Match when defining it: `%User{} = user = find_user_by_id(42)`.

## Resources

- Paper: *The Design Principles of the Elixir Type System*, Giuseppe Castagna, Guillaume Duboc and José Valim
- Video: *The foundations of the Elixir type system*, José Valim
- Video: *Precision in type system design*, José Valim

The type system comes from a partnership between CNRS and Remote. Development is sponsored by Fresha and Tidewave.

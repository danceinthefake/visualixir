# Gradual set-theoretic types

Source: [Elixir reference, Gradual set-theoretic types](https://elixir.hexdocs.pm/gradual-set-theoretic-types.html).

Elixir is adding set-theoretic types to the compiler. This page describes the current stage. The type system is:

- **sound:** the types that it infers and assigns agree with how the program behaves
- **gradual:** it has a `dynamic()` type for things that the system checks at runtime. But `dynamic()` works as a **range**: `dynamic(integer() or binary())` still reports a violation if the code accepts none of those types. Without `dynamic()`, the system behaves as a static system
- **friendly to developers:** you build types with set operations: union, intersection, and negation

The current milestone **infers** types from existing programs and uses them for type checking, so the compiler finds bugs without changes to your code. Signatures that users provide are planned for later.

<Diagram name="gradual-set-theoretic-types/roadmap" caption="Three milestones. The first is the current milestone." />

## A gentle introduction

You write types like calls: `integer()`, `list(integer())`. The basic types are `atom()`, `binary()`, `bitstring()`, `empty_list()`, `integer()`, `float()`, `function()`, `map()`, `non_empty_list(elem_type, tail_type)`, `pid()`, `port()`, `reference()`, and `tuple()`.

You can write many of them more precisely: `:ok` for one atom, `{:ok, integer()}` for a tuple with two elements. There are three special types: `none()` (the empty set), `term()` (everything), and `dynamic()` (a range).

Combine them with `or`, `and`, and `not`. `atom() or integer()` is either type. `atom() and integer()` is the empty set, `none()`. A **difference** combines the two operations: all atoms except `nil` is `atom() and not nil`. The full syntax is in the [types cheatsheet](../cheatsheets/types-cheat).

## The syntax of data types

Developers see these types mainly in compiler warnings.

**Broad types** cannot name individual elements: `binary()`, `bitstring()`, `integer()`, `float()`, `pid()`, `port()`, `reference()`. `binary()` is a subtype of `bitstring()`, because a binary is a bitstring with a number of bits that 8 divides without a remainder.

**Atoms:** `atom()` for all atoms, or each literal (`:foo`, `nil`, `true`, `false`) as its own type. `boolean()` is `true or false`.

**Tuples:** `tuple()`, or `{:ok, binary()}`. A trailing `...` means that the size is unknown: `{:ok, binary(), ...}` has at least two elements.

**Lists:** `list()` is all proper lists, including `[]`. `list(integer())` includes `[]` and `[1, 2, 3]`, but not `[1, "two", 3]`. Internally, `list(a)` is `empty_list() or non_empty_list(a)`.

### Improper lists

A second argument to `non_empty_list` is the type of the tail. The tail of a proper list is the empty list. If the type of the tail is not a list, the list is improper. The system merges the tail of a list into the element type.

<Diagram name="gradual-set-theoretic-types/list-equivalences" caption="Different spellings of the same list types." />

### Maps

`map()` is all maps (the same as `%{...}`). This is the literal syntax:

```elixir
%{name: binary(), age: integer()}       # closed: exactly these keys
%{..., name: binary(), age: integer()}  # open: these keys, other keys allowed
```

`empty_map()` is the empty map (`%{}` also works). **Optional keys** use `if_set/1`: `%{name: binary(), age: if_set(integer())}` always has `:name` and can have `:age`. `not_set()` says that a key is absent: `%{..., age: not_set()}` is the type that `Map.delete(map, :age)` returns.

**Domain keys** are types and not atoms (`%{binary() or atom() => integer()}`, or open with `...`). The system tracks only the top of each type: `%{list(integer()) => integer(), list(binary()) => binary()}` is the same as `%{list() => integer() or binary()}`. The supported domains are `atom()`, `bitstring()`, `binary()`, `integer()`, `float()`, `fun()`, `list()`, `map()`, `pid()`, `port()`, `reference()`, and `tuple()`. Domain keys are always optional (you cannot store every integer as a key), so a fetch can find nothing.

**Mixed keys** combine both kinds. They are in order of increasing precision, as duplicate keys override earlier keys at runtime: `%{atom() => binary(), root: integer()}`.

### Functions

`function()` is all functions. An arrow describes one function: `(integer() -> boolean())`, `(integer(), integer() -> binary())`. Several clauses mean an **intersection**:

```elixir
def negate(x) when is_integer(x), do: -x
def negate(x) when is_boolean(x), do: not x
```

This function has the type `(integer() -> integer())` and also `(boolean() -> boolean())`, so its type is `(integer() -> integer()) and (boolean() -> boolean())`. It belongs to both sets.

<Diagram name="gradual-set-theoretic-types/negate-fn" caption="Two clauses and one intersection." />

Why an intersection and not a union? Take a shirt with green and yellow stripes. It is in the set of shirts with green, and in the set of shirts with yellow. "Green **or** yellow" is true but includes shirts that are only green. "Green **and** yellow" captures both facts. In practice, a union of two functions is not useful, and the compiler points you to the correct one.

<Diagram name="gradual-set-theoretic-types/sets" caption="An intersection is more precise than a union." />

## The `dynamic()` type

Existing programs have no type declarations, so Elixir types `negate/1` as `(dynamic() -> dynamic())`. Patterns and guards then refine `x` to `dynamic() and integer()` and `dynamic() and boolean()` in each clause. This makes `dynamic()` a *gradual* type, and so the name is *gradual set-theoretic types*.
Think of `dynamic()` as a range of types. With `var` of type `atom() or integer()`, `Integer.to_string(var)` gives a warning, because it does not accept atoms. With `dynamic() and (atom() or integer())` (written `dynamic(atom() or integer())`), there is no warning, because the call works for at least one type.

<Diagram name="gradual-set-theoretic-types/dynamic-range" caption="dynamic() gives a warning only when it is certain that the code fails." />

In comparison with other gradually typed languages, `dynamic()` here is powerful. It restricts the program with intersections and still gives a warning when failure is certain. If you provide your own types that are not `dynamic()`, the system is fully static.

Dynamic types are always at the **root**. `{:ok, dynamic()}` is rewritten to `dynamic({:ok, term()})`. You cannot make only a part of a tuple, map, or list gradual, but `dynamic()` can never enter statically typed code.

## Type inference

Inference deduces types at compile time. It has trade-offs:

<Diagram name="gradual-set-theoretic-types/inference" caption="Inference gives checking without annotations and has costs on four fronts." />

- **Speed:** inference is often more expensive than checking.
- **Expressiveness:** what the system can infer is a subset of what it can check.
- **Incremental compilation:** if A depends on B and B depends on C, a change in C can change the signature of B and force the system to compute A again.
- **Cascading errors:** conflicting assumptions can produce messages that are less clear.

The inference of Elixir is **best effort**. It finds bugs where *all* combinations of a type fail. It does not promise to find every incompatibility. It infers across the standard library and your dependencies, and it treats calls to modules in the **same project** as `dynamic()`. Later, the system will check functions with explicit signatures against them, as static languages do.

### False positives

Inference avoids reports of violations where no runtime error happens, with two documented exceptions:

- **`for` assumes that it runs at least once.** In `for _i <- list do Atom.to_string(x) end` followed by `x + 1`, the checker assumes that `x` is an atom. If `list` is empty, there is no runtime error, but the checker still gives a warning. Wrap the loop in `if list != [] do`.
- **The type system must prove a struct update statically.** `%User{user | name: "John Doe"}` gives a warning unless the type system can prove that `user` is a `User`, even if it is always a `User` at runtime. Match when you define it: `%User{} = user = find_user_by_id(42)`.

## Roadmap

Elixir now infers types for all language constructs. The goal is to assess performance and collect feedback on the quality of error messages before it adds types that users write.

If the results are satisfactory, the next milestone is **typed structs**. Programs often pattern match on structs. This shows the fields but not their types. When the system passes field types through the program, the checker can find more errors.

The third milestone is **set-theoretic type signatures for functions**. Erlang typespecs are not precise enough for set-theoretic types. When this stage is done, the language will phase them out and move their post-processing into a separate library.

## Resources

- Paper: *The Design Principles of the Elixir Type System*, Giuseppe Castagna, Guillaume Duboc and José Valim
- Video: *The foundations of the Elixir type system*, José Valim
- Video: *Precision in type system design*, José Valim

The type system comes from a partnership between CNRS and Remote. Fresha and Tidewave sponsor the development.

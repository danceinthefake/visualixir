# Design-related anti-patterns

Source: [Elixir guide, Design-related anti-patterns](https://elixir.hexdocs.pm/design-anti-patterns.html).

Anti-patterns about modules, functions and the role they play. Six of them.

## Alternative return types

**Problem:** an options argument (usually a keyword list) drastically changes the return type, so you can't tell what the function returns without knowing the options.

```elixir
AlternativeInteger.parse("13")                        #=> {13, ""}
AlternativeInteger.parse("13", discard_rest: true)    #=> 13
```

**Refactoring:** one function per return type: `parse/1` and `parse_discard_rest/1`.

<Diagram name="design-anti-patterns/alt-return" caption="A function's return type shouldn't depend on its options." />

## Boolean obsession

**Problem:** several booleans with overlapping meaning encode state that atoms express better. With `admin: true` and `editor: true`, `:editor` has no effect if `:admin` is set.

```elixir
cond do
  options[:admin] -> …
  options[:editor] -> …
  true -> …
end
```

**Refactoring:** one `:role` option, `:admin`, `:editor` or `:default`. The same goes for struct fields. Even a single boolean can be an atom (`status: :approved`) that leaves room for a `:pending` state later. There is no performance cost, since booleans are atoms.

<Diagram name="design-anti-patterns/boolean" caption="Four combinations for three real states." />

## Exceptions for control flow

**Problem:** using `try/rescue` to decide what happens next, when a `case` on a returned tuple would do. Library authors should let callers decide whether an error is exceptional.

```elixir
try do
  IO.puts(File.read!(file))
rescue
  e -> IO.puts(:stderr, Exception.message(e))
end
```

**Refactoring:** use the non-raising `File.read/1` and match:

```elixir
case File.read(file) do
  {:ok, binary} -> IO.puts(binary)
  {:error, reason} -> IO.puts(:stderr, "could not read file #{file}: #{reason}")
end
```

Libraries should offer both, with the bang version built on the plain one. A common convention: the plain function returns `{:ok, result}` or `{:error, Exception.t}`, so the caller can `raise` it.

<Diagram name="design-anti-patterns/exceptions" caption="The plain function is the foundation. The bang version wraps it." />

Raising is fine for invalid arguments (`File.read(123)`), in tests and scripts, and in frameworks such as Phoenix that turn exceptions into HTTP responses.

## Primitive obsession

**Problem:** basic types (strings, integers, floats) carry structured information. An address as one string means you keep parsing it. Floats for money are another example (use a richer type).

**Refactoring:** parse once into a struct and pass that around:

```elixir
defmodule Address do
  defstruct [:street, :city, :state, :postal_code, :country]
end

def extract_postal_code(%Address{} = address), do: …
```

<Diagram name="design-anti-patterns/primitive" caption="Parse at the edge, use structure inside." />

## Unrelated multi-clause function

**Problem:** clauses of one function do completely different things, and the `@doc` fills with conditionals.

```elixir
def update(%Product{count: count, material: material}), do: …
def update(%Animal{count: count, skin: skin}), do: …
```

**Refactoring:** split into `update_product/1` and `update_animal/1` (or separate modules), each with its own `@doc`. A function may still have several clauses if they group *related* behavior. Elixir's `+/2` handles integers and floats together, but strings get `<>/2`. `struct/2` works for any struct because it behaves the same for all of them.

<Diagram name="design-anti-patterns/multi-clause" caption="Clauses should share a purpose." />

## Using application configuration for libraries

**Problem:** the application environment is **global**. A library that reads its behavior from it lets each key have only one value, so two apps depending on the same library can't configure it differently.

```elixir
parts = Application.fetch_env!(:app_config, :parts)
String.split(string, "-", parts: parts)
```

**Refactoring:** take options on the function: `split(string, opts \\ [])`, with defaults.

<Diagram name="design-anti-patterns/app-config" caption="Options belong to the call, not to the whole VM." />

Not every use is wrong: swapping a component that must behave identically (a CSV parser), ideally with a behaviour that fixes its semantics.

- **Supervision trees:** the library provides a **child spec** instead of starting its own tree, and you list it in yours: `{DNSCluster, query: "my.subdomain"}`. You can read the environment yourself.
- **Compile-time configuration:** let users generate the code: `use Ecto.Repo, adapter: …` so you can define as many repos as you want.
- **Mix tasks:** read per-project config from `Mix.Project.config/0` (a key in `project/0`) or from command-line options with `OptionParser`.

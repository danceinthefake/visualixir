# Design-related anti-patterns

Source: [Elixir guide, Design-related anti-patterns](https://elixir.hexdocs.pm/design-anti-patterns.html).

These anti-patterns are about modules, functions, and the role that they play. There are six.

## Alternative return types

**Problem:** an options argument (usually a keyword list) changes the return type in a big way, so you cannot tell what the function returns unless you know the options.

```elixir
AlternativeInteger.parse("13")                        #=> {13, ""}
AlternativeInteger.parse("13", discard_rest: true)    #=> 13
```

**Refactoring:** use one function for each return type: `parse/1` and `parse_discard_rest/1`.

<Diagram name="design-anti-patterns/alt-return" caption="The return type of a function must not depend on its options." />

## Boolean obsession

**Problem:** several booleans with overlapping meaning encode a state that atoms express better. With `admin: true` and `editor: true`, `:editor` has no effect if `:admin` is set.

```elixir
cond do
  options[:admin] -> …
  options[:editor] -> …
  true -> …
end
```

**Refactoring:** use one `:role` option with the values `:admin`, `:editor`, or `:default`. The same is true for struct fields. Even a single boolean can be an atom (`status: :approved`) that leaves room for a `:pending` state later. There is no cost in performance, because booleans are atoms.

<Diagram name="design-anti-patterns/boolean" caption="Four combinations for three real states." />

## Exceptions for control flow

**Problem:** `try/rescue` decides what happens next, when a `case` on a returned tuple is enough. Authors of libraries must let callers decide if an error is exceptional.

```elixir
try do
  IO.puts(File.read!(file))
rescue
  e -> IO.puts(:stderr, Exception.message(e))
end
```

**Refactoring:** use the `File.read/1` function that does not raise errors, and match on its result:

```elixir
case File.read(file) do
  {:ok, binary} -> IO.puts(binary)
  {:error, reason} -> IO.puts(:stderr, "could not read file #{file}: #{reason}")
end
```

Libraries must offer both variants, with the bang version built on the plain version. By convention, the plain function returns `{:ok, result}` or `{:error, Exception.t}`, so the caller can `raise` it.

<Diagram name="design-anti-patterns/exceptions" caption="The plain function is the foundation. The bang version wraps it." />

It is acceptable to raise errors for invalid arguments (`File.read(123)`), in tests and scripts, and in frameworks such as Phoenix that turn exceptions into HTTP responses.

## Primitive obsession

**Problem:** basic types (strings, integers, floats) carry structured information. If an address is one string, you must parse it again and again. Floats for money are another example (use a richer type).

**Refactoring:** parse once into a struct and pass the struct around:

```elixir
defmodule Address do
  defstruct [:street, :city, :state, :postal_code, :country]
end

def extract_postal_code(%Address{} = address), do: …
```

<Diagram name="design-anti-patterns/primitive" caption="Parse at the edge and use structure inside." />

## Unrelated multi-clause function

**Problem:** the clauses of one function do completely different things, and the `@doc` fills with conditionals.

```elixir
def update(%Product{count: count, material: material}), do: …
def update(%Animal{count: count, skin: skin}), do: …
```

**Refactoring:** split the function into `update_product/1` and `update_animal/1` (or separate modules), each with its own `@doc`. A function can still have several clauses if they group *related* behavior. The `+/2` function of Elixir handles integers and floats together, but strings use `<>/2`. `struct/2` works for any struct because it behaves in the same way for all of them.

<Diagram name="design-anti-patterns/multi-clause" caption="Clauses must share a purpose." />

## Using application configuration for libraries

**Problem:** the application environment is **global**. A library that reads its behavior from it lets each key have only one value. Two applications that depend on the same library cannot configure it in different ways.

```elixir
parts = Application.fetch_env!(:app_config, :parts)
String.split(string, "-", parts: parts)
```

**Refactoring:** take options on the function: `split(string, opts \\ [])`, with defaults.

<Diagram name="design-anti-patterns/app-config" caption="Options belong to the call, not to the whole VM." />

Not every use is wrong. One example is to swap a component that must behave in an identical way (a CSV parser), ideally with a behaviour that fixes its semantics.

- **Supervision trees:** the library provides a **child spec** and does not start its own tree. You list the spec in your tree: `{DNSCluster, query: "my.subdomain"}`. You can read the environment yourself.
- **Compile-time configuration:** let users generate the code: `use Ecto.Repo, adapter: …`, so that you can define as many repos as you want.
- **Mix tasks:** read the configuration of each project from `Mix.Project.config/0` (a key in `project/0`) or from command-line options with `OptionParser`.

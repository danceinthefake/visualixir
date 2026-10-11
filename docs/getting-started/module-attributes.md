# Module attributes

Source: [Elixir guide, Module attributes](https://elixir.hexdocs.pm/module-attributes.html).

An attribute (`@name value`) has three uses: to annotate modules and functions, to hold temporary storage during compilation, and to act as a compile-time constant.

## As annotations

Reserved attributes include `@moduledoc` (module docs), `@doc` (docs for the next function), `@spec` (a typespec for the next function), and `@behaviour`. The `@behaviour` attribute (British spelling) declares an OTP or user-defined behaviour.

```elixir
defmodule Math do
  @moduledoc """
  Provides math-related functions.
  """

  @doc "Calculates the sum of two numbers."
  def sum(a, b), do: a + b
end
```

The compiled `.beam` file stores the docs, so `h Math` and `h Math.sum` work after you compile with `c("math.ex", ".")`. In real projects, Mix compiles the code and [ExDoc](https://github.com/elixir-lang/ex_doc) turns the docs into HTML.

## As temporary storage

Set an attribute with a value and read it by name. Do not put a newline between the name and the value. If you do, Elixir thinks that you are reading the attribute.

```elixir
defmodule MyApp.Status do
  @service URI.parse("https://example.com")

  def status(email) do
    SomeHttpClient.get(@service)
  end
end
```

The expression runs **once, at compile time**, and Elixir pastes its *result* into the function. After the compilation, the attribute is gone, except in the functions that read it. You cannot call functions that are defined in the same module inside the attribute, because they do not exist yet.

<Diagram name="module-attributes/compile-time" caption="Elixir computes the value at compile time and puts it in the function body." />

Each read inside a function takes a **snapshot** of the value, and the compiler must compile every snapshot. If you read the same attribute in many places, the compilation is slower. Read it in one small function instead:

```elixir
def some_function, do: do_something_with(example())
def another_function, do: do_something_else_with(example())
defp example, do: @example
```

<Diagram name="module-attributes/snapshots" caption="One reader makes one snapshot." />

<UnderTheHood>

**In storage.** Elixir computes the value once, when the module compiles, and writes it into the `.beam` file. For a module with an attribute of 5000 elements, the file was 36,448 bytes and its `LitT` (literals) chunk was 24,311 bytes of that. When the system loads the module, it reads that file from disk.

**In memory.** After the module loads, the literal is outside every process heap, in the memory that the system keeps for the module. `get/0` returns a pointer to it. Two calls returned the same term (`:erts_debug.same/2` was `true`). After 1000 calls that returned a literal of 2000 words, the process heap did not grow. The Efficiency Guide adds that the system does not copy a literal that it sends to another process on the same node.

<Diagram name="module-attributes/uth-literal" caption="The .beam file stores the value of an attribute and every call shares it." />

*Sources:* we took the chunk sizes from `:beam_lib.info/1` and measured the rest on Erlang/OTP 29. The [Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html) describes literals.

</UnderTheHood>

## As compile-time constants

For a plain constant, a function is usually enough. Prefer `defp hours_in_a_day(), do: 24` to `@hours_in_a_day 24`. A function can also return a composite of plain data (no calls and no operators), such as `%{timezone: "Etc/UTC", locale: "pt-BR"}`. The system allocates it once and shares it across every call.

Attributes are useful when you must compute something at compile time. This is most common inside patterns and guards, which allow only a few expressions:

```elixir
@default_timezone "Etc/UTC"
def shift(@default_timezone), do: ...

@time_periods [:am, :pm]
def shift(time, period) when period in @time_periods, do: ...
```

## Going further

Libraries use attributes as custom annotations. ExUnit stores `async: true` in an attribute. It also lets you stack `@tag :external` before a test, because attributes can be *accumulated* (`Module.register_attribute/3`).

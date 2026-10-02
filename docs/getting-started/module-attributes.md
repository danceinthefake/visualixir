# Module attributes

Source: [Elixir guide, Module attributes](https://elixir.hexdocs.pm/module-attributes.html).

An attribute (`@name value`) serves three purposes: annotating modules and functions, holding temporary storage during
compilation, and acting as a compile-time constant.

## As annotations

Reserved attributes include `@moduledoc` (module docs), `@doc` (docs for the next function), `@spec` (a typespec for
the next function) and `@behaviour` (British spelling, declares an OTP or user-defined behaviour).

```elixir
defmodule Math do
  @moduledoc """
  Provides math-related functions.
  """

  @doc "Calculates the sum of two numbers."
  def sum(a, b), do: a + b
end
```

Docs are stored in the compiled `.beam` file, so `h Math` and `h Math.sum` work after compiling with `c("math.ex", ".")`.
In real projects Mix compiles the code and [ExDoc](https://github.com/elixir-lang/ex_doc) turns docs into HTML.

## As temporary storage

Set an attribute with a value, read it by name. Don't put a newline between name and value, or Elixir thinks you're reading it.

```elixir
defmodule MyApp.Status do
  @service URI.parse("https://example.com")

  def status(email) do
    SomeHttpClient.get(@service)
  end
end
```

The expression runs **once, at compile time**, and its *result* is pasted into the function. After compilation the attribute
is gone, except in the functions that read it. You can't call functions defined in the same module inside the attribute,
because they don't exist yet.

<Diagram name="module-attributes/compile-time" caption="The value is computed at compile time and baked into the function body." />

Each read inside a function takes a **snapshot** of the value, and every snapshot has to be compiled. Reading the same attribute in
many places slows compilation, so read it in one small function instead:

```elixir
def some_function, do: do_something_with(example())
def another_function, do: do_something_else_with(example())
defp example, do: @example
```

<Diagram name="module-attributes/snapshots" caption="One reader means one snapshot." />

<UnderTheHood>

**In storage.** The value is computed once, when the module compiles, and written into the `.beam` file. For a module with a 5000-element attribute, the file was 36,448 bytes and its `LitT` (literals) chunk was 24,311 of them. Loading the module reads that file from disk.

**In memory.** Once loaded, the literal sits outside every process heap, in the memory kept for the module. `get/0` returns a pointer to it. Two calls returned the same term (`:erts_debug.same/2` was `true`), and after 1000 calls returning a 2000-word literal the process heap had not grown at all. The Efficiency Guide adds that a literal sent to another process on the same node is not copied.

<Diagram name="module-attributes/uth-literal" caption="An attribute's value is stored in the .beam file and shared by every call." />

*Sources:* chunk sizes from `:beam_lib.info/1`, the rest measured on Erlang/OTP 29. Literals are described in the [Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html).

</UnderTheHood>

## As compile-time constants

For a plain constant, a function is usually enough: prefer `defp hours_in_a_day(), do: 24` over `@hours_in_a_day 24`. A
function can also return a composite of plain data (no calls, no operators), such as `%{timezone: "Etc/UTC", locale: "pt-BR"}`. It is allocated once and shared across every call.

Attributes earn their place when you must compute something at compile time, most often inside patterns and guards, which
allow only a few expressions:

```elixir
@default_timezone "Etc/UTC"
def shift(@default_timezone), do: ...

@time_periods [:am, :pm]
def shift(time, period) when period in @time_periods, do: ...
```

## Going further

Libraries use attributes as custom annotations. ExUnit stores `async: true` in one, and lets you stack `@tag :external`
before a test because attributes can be *accumulated* (`Module.register_attribute/3`).

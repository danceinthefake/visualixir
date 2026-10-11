# Meta-programming anti-patterns

Source: [Elixir guide, Meta-programming anti-patterns](https://elixir.hexdocs.pm/macro-anti-patterns.html).

These anti-patterns are about macros and code generation. There are five.

## Compile-time dependencies

**Problem:** each use of a macro adds a compile-time dependency on the module that defines the macro. It is worse when a macro is used in the *body* of a module, because its **arguments** can also become compile-time dependencies. Then a change in one file recompiles many files.

```elixir
defmodule MyApp do
  use Plug.Builder
  plug MyApp.Authentication
end
```

`plug` stores the module in `@plugs`, and `MyApp.Authentication` is only *called* at runtime. But `plug` ran at compile time, so it is now a compile-time dependency of `MyApp`.

**Refactoring:** expand the literal as if it were inside the function where it is used:

```elixir
defmacro plug(mod) do
  mod = Macro.expand_literals(mod, %{__CALLER__ | function: {:call, 2}})
  quote do
    @plugs unquote(mod)
  end
end
```

Now it is a runtime dependency. Do this only if the macro does not call functions, read structs, or inspect the module at compile time. Use `mix xref trace path/to/file.ex` to see the compile-time, runtime, and export dependencies of a file.

<Diagram name="macro-anti-patterns/compile-deps" caption="A compile-time dependency pulls its own dependencies into the recompilation." />

## Large code generation

**Problem:** a macro that expands into much code makes the compilation slower and the artifacts larger. The system expands and compiles it at *every* call, and a router can have hundreds of `get/2`.

**Refactoring:** keep the quote small and give the work to a function:

```elixir
defmacro get(route, handler) do
  quote do
    Routes.__define__(__MODULE__, unquote(route), unquote(handler))
  end
end

def __define__(module, route, handler) do
  # checks, raises, Module.put_attribute(...)
end
```

<Diagram name="macro-anti-patterns/large-gen" caption="The system compiles the checks once, not once for each route." />

<UnderTheHood>

**What the extra code costs.** We generated 300 functions with a macro in two ways. In the fat macro, the checks were inside every generated function. In the thin macro, each function was one call to one shared function that holds the checks. The fat version produced a `.beam` of 142,968 bytes that compiled in 263 ms. The thin version produced a `.beam` of 56,324 bytes that compiled in 54 ms. The file is 2.5 times larger and the compile time is about 5 times longer. The system compiles and stores the generated code once for each call to the macro, so it grows with every use.

<Diagram name="macro-anti-patterns/uth-large-gen" caption="The system compiles the code that a macro generates, and writes it to the .beam, once for each call." />

*Sources:* we measured with `Code.compile_string/1` and `:timer.tc/1` on Elixir 1.20 / OTP 29. If the code of the macro runs while the module compiles, as with attributes, the file does not grow. The compile time still grows (130 ms against 20 ms in our first try).

</UnderTheHood>

## Unnecessary macros

**Problem:** a macro where a function is enough makes the code harder to read, harder to reason about, and harder to change.

```elixir
defmacro sum(v1, v2) do
  quote do: unquote(v1) + unquote(v2)
end
```

**Refactoring:** a plain function. It needs no `require`:

```elixir
def sum(v1, v2), do: v1 + v2
```

This is the guidance from the [Macros](../meta-programming/macros) chapter: macros are a last resort.

## `use` instead of `import`

**Problem:** `import` and `alias` are lexical, and they only let a module call another module. `use` lets a module inject **any** code, including propagated imports. You must know the internals of the library to know what your module now contains.

```elixir
defmodule Library do
  defmacro __using__(_opts) do
    quote do
      import Library
      import ModuleA   # propagated
    end
  end
end

defmodule ClientApp do
  use Library
  def foo, do: "local"   # error: imported ModuleA.foo/0 conflicts with local function
end
```

**Refactoring:** avoid `__using__/1` when `alias` or `import` is enough. `ClientApp` only does `import Library`.

<Diagram name="macro-anti-patterns/use-import" caption="use hides what Elixir injects. import shows it." />

When you really need more, `use` is the common extension point. Document its effects in `@moduledoc` like a nutrition label, and list only the changes to the public API. For example: *When you `use GenServer`, the `GenServer` module will set `@behaviour GenServer` and define a `child_spec/1` function, so your module can be used as a child in a supervision tree.*

## Untracked compile-time dependencies

**Problem:** this is the opposite case. The compiler cannot see a compile-time dependency, so it does not recompile when it must. This happens when you **build module names dynamically**.

```elixir
mods = [OtherModule.Foo, OtherModule.Bar]     # fine: literals are tracked
for mod <- mods, do: mod.example()

for part <- [:Foo, :Bar] do                   # bad: the compiler only sees OtherModule
  Module.concat(OtherModule, part).example()
end
```

Atoms such as `:"Elixir.OtherModule.Foo"` that you write directly have the same problem, because Elixir never sees the aliases.

<Diagram name="macro-anti-patterns/untracked" caption="The compiler tracks only literal aliases." />

**Refactoring:** use full module names. If you must build them, do it in a macro at compile time, so that the compiler still sees them:

```elixir
defmacro call_examples(parts) do
  for part <- parts do
    quote do
      OtherModule.unquote(part).example()
    end
  end
end
```

`mix xref trace` helps you make sure that the compiler tracks the dependencies.

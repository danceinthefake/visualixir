# Meta-programming anti-patterns

Source: [Elixir guide, Meta-programming anti-patterns](https://elixir.hexdocs.pm/macro-anti-patterns.html).

Anti-patterns about macros and code generation. Five of them.

## Compile-time dependencies

**Problem:** any macro use adds a compile-time dependency on the module defining the macro. Worse, when a macro is used in a module *body*, its **arguments** can become compile-time dependencies too, so changing one file recompiles many.

```elixir
defmodule MyApp do
  use Plug.Builder
  plug MyApp.Authentication
end
```

`plug` stores the module in `@plugs`, and `MyApp.Authentication` is only *called* at runtime. But because `plug` ran at compile time, it is now a compile-time dependency of `MyApp`.

**Refactoring:** expand the literal as if it were inside the function where it's used:

```elixir
defmacro plug(mod) do
  mod = Macro.expand_literals(mod, %{__CALLER__ | function: {:call, 2}})
  quote do
    @plugs unquote(mod)
  end
end
```

Now it's a runtime dependency. Only do this if the macro doesn't call functions, read structs or inspect the module at compile time. Use `mix xref trace path/to/file.ex` to see a file's compile-time, runtime and export dependencies.

<Diagram name="macro-anti-patterns/compile-deps" caption="A compile-time dependency drags its own dependencies into recompilation." />

## Large code generation

**Problem:** a macro that expands into a lot of code makes compilation slower and the artifacts larger, because it's expanded and compiled at *every* call, and a router can have hundreds of `get/2`.

**Refactoring:** keep the quote tiny and delegate the work to a function:

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

<Diagram name="macro-anti-patterns/large-gen" caption="The checks are compiled once, not once per route." />

<UnderTheHood>

**What the extra code costs.** I generated 300 functions with a macro in two ways. In the fat macro, the checks were written inside every generated function. In the thin macro, each function was a single call to one shared function that holds the checks. The fat version produced a 142,968-byte `.beam` compiled in 263 ms, and the thin one a 56,324-byte `.beam` in 54 ms: 2.5 times the file and about 5 times the compile time. The generated code is compiled and stored once per call to the macro, so it grows with every use.

<Diagram name="macro-anti-patterns/uth-large-gen" caption="Code a macro generates is compiled and written to the .beam once per call." />

*Sources:* measured with `Code.compile_string/1` and `:timer.tc/1` on Elixir 1.20 / OTP 29. If the macro's code runs while the module compiles, as with attributes, the file doesn't grow, but the compile time still does (130 ms against 20 ms in my first try).

</UnderTheHood>

## Unnecessary macros

**Problem:** a macro where a function would do makes code harder to read and reason about, and harder to evolve.

```elixir
defmacro sum(v1, v2) do
  quote do: unquote(v1) + unquote(v2)
end
```

**Refactoring:** a plain function, with no `require` needed:

```elixir
def sum(v1, v2), do: v1 + v2
```

This is the guidance from the [Macros](../meta-programming/macros) chapter: macros are a last resort.

## `use` instead of `import`

**Problem:** `import` and `alias` are lexical and only let a module call another. `use` lets a module inject **any** code, including propagated imports, so you must know the library's internals to know what your module now contains.

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

**Refactoring:** avoid `__using__/1` when `alias` or `import` would do. `ClientApp` just does `import Library`.

<Diagram name="macro-anti-patterns/use-import" caption="use hides what gets injected. import shows it." />

When you truly need more, `use` is the common extension point. Document its effects in `@moduledoc` like a nutrition label, listing only changes to the public API. For example: *When you `use GenServer`, the `GenServer` module will set `@behaviour GenServer` and define a `child_spec/1` function, so your module can be used as a child in a supervision tree.*

## Untracked compile-time dependencies

**Problem:** the opposite: a compile-time dependency the compiler can't see, so it doesn't recompile when it should. It happens when module names are **built dynamically**.

```elixir
mods = [OtherModule.Foo, OtherModule.Bar]     # fine: literals are tracked
for mod <- mods, do: mod.example()

for part <- [:Foo, :Bar] do                   # bad: the compiler only sees OtherModule
  Module.concat(OtherModule, part).example()
end
```

Writing `:"Elixir.OtherModule.Foo"` atoms directly has the same problem, since Elixir never sees the aliases.

<Diagram name="macro-anti-patterns/untracked" caption="Only literal aliases are tracked." />

**Refactoring:** use full module names. If you must build them, do it in a macro at compile time so the compiler still sees them:

```elixir
defmacro call_examples(parts) do
  for part <- parts do
    quote do
      OtherModule.unquote(part).example()
    end
  end
end
```

`mix xref trace` helps check that dependencies are tracked.

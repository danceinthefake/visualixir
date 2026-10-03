# Macros

Source: [Elixir guide, Macros](https://elixir.hexdocs.pm/macros.html).

Macros are harder to write than functions, and using them when you don't need to is bad style. Use them as a **last resort**: *explicit is better than implicit*, and *clear code
is better than concise code*.

## Our first macro

Macros use `defmacro/2`. Here is `unless` as a function and as a macro:

```elixir
defmodule Unless do
  def fun_unless(clause, do: expression) do
    if(!clause, do: expression)
  end

  defmacro macro_unless(clause, do: expression) do
    quote do
      if(!unquote(clause), do: unquote(expression))
    end
  end
end
```

```elixir
require Unless
Unless.macro_unless(true, do: IO.puts("this should never be printed"))   #=> nil
Unless.fun_unless(true, do: IO.puts("this should never be printed"))
# prints "this should never be printed"
```

Function arguments are **evaluated before the call**. A macro's are **not**. It receives them as quoted expressions and returns another quoted expression.

<Diagram name="macros/macro-vs-function" caption="The macro rewrites the code. The function only sees results." />

What the macro receives and what it returns, expanded at compile time:

<Diagram name="macros/expansion" caption="A macro is a function from quoted expressions to a quoted expression." />

`Macro.expand_once/2` lets you check: `Macro.expand_once(expr, __ENV__) |> Macro.to_string()` prints `if(!true) do IO.puts("…") end`.

`if/2` is itself a macro, as are `def/2`, `defmacro/2` and `defprotocol/2`. They are ordinary Elixir. That is what lets you extend the language for your domain.
Only the *special forms* (see `Kernel.SpecialForms`) can't be overridden.

<UnderTheHood>

**What a macro call becomes.** We compiled the chapter's `unless` both ways and read the caller with `:beam_disasm`. For the macro, the caller holds the expansion already: a `select_val` on the condition, and a call to `IO.puts` only on the path that needs it. There is no call to the macro's module at all, because the macro ran while the caller was being compiled.

For the function, the caller first calls `IO.puts`, since arguments are evaluated before the call, then builds the keyword list and calls `fun_unless/2`. That is the difference the chapter describes, as machine instructions: a macro changes the code that is compiled, a function receives values at runtime.

<Diagram name="macros/uth-expansion" caption="A macro leaves its result in the caller. A function is called with already-evaluated arguments." />

*Sources:* disassembled with `:beam_disasm` on Elixir 1.20 / OTP 29. The instructions chosen can differ between compiler versions.

</UnderTheHood>

## Hygiene

Macros have *late resolution*: a variable set inside a quote doesn't clash with one in the caller.

```elixir
defmodule Hygiene do
  defmacro no_interference do
    quote do: a = 1
  end
end

defmodule HygieneTest do
  def go do
    require Hygiene
    a = 13
    Hygiene.no_interference()
    a
  end
end

HygieneTest.go()   #=> 13
```

To deliberately touch the caller's variable use `var!/1`:

```elixir
defmacro interference do
  quote do: var!(a) = 1
end
# HygieneTest.go() now returns 1  (with a warning that the original a is unused)
```

<Diagram name="macros/hygiene" caption="Hygiene is a context. var! removes it." />

How it works: each variable carries a **context** in its third element. A variable written by you in the module is `{:x, [line: 3], nil}`. A quoted one, from inside `Sample`, is
`{:x, [line: 3], Sample}`:

```elixir
defmodule Sample do
  def quoted do
    quote do: x
  end
end

Sample.quoted()   #=> {:x, [line: 3], Sample}
```

Different contexts, different variables. The same mechanism covers imports and aliases, and can be bypassed with `var!/2` and `alias!/1` (be careful).

For variables whose names are built dynamically, use `Macro.var/2`:

```elixir
defmodule Sample do
  defmacro initialize_to_char_count(variables) do
    Enum.map(variables, fn name ->
      var = Macro.var(name, nil)
      length = name |> Atom.to_string() |> String.length()

      quote do
        unquote(var) = unquote(length)
      end
    end)
  end

  def run do
    initialize_to_char_count([:red, :green, :yellow])
    [red, green, yellow]
  end
end

Sample.run()   #=> [3, 5, 6]
```

The second argument to `Macro.var/2` is the **context**, which determines hygiene as described above. `Macro.unique_var/2` makes fresh names.

## The environment

`__ENV__/0` returns a `Macro.Env` struct describing the compile-time environment: current module, file, line, variables in scope, imports, requires. Many
`Macro` functions take one, for example `Macro.expand_once/2`.

## Private macros

`defmacrop` defines a macro only usable inside its module, at compile time. A macro must be **defined before it's used**: otherwise the call isn't expanded and becomes a call to a
missing function (`CompileError: function two/0 undefined`).

## Write macros responsibly

- **Hygienic:** variables, function calls and aliases inside a macro don't leak into the caller.
- **Lexical:** nothing is injected globally. You must `require` or `import` the module that defines the macro.
- **Explicit:** a macro only runs where you call it. No hidden rewriting of other functions.
- **Clear language:** `quote` and `unquote` are spelled out, so the boundaries of a macro are visible.

Even so, macros are not your API. Keep the quoted part **minimal** and put the real work in a function:

```elixir
defmacro my_macro(a, b, c) do
  quote do
    MyModule.do_this_that_and_that(unquote(a), unquote(b), unquote(c))
  end
end

def do_this_that_and_that(a, b, c), do: ...
```

<Diagram name="macros/thin-macro" caption="The function is easy to test, and usable by people who don't want the macro." />

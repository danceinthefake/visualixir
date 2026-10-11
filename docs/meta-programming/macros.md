# Macros

Source: [Elixir guide, Macros](https://elixir.hexdocs.pm/macros.html).

Macros are harder to write than functions, and it is bad style to use them when you do not need them. Use them as a **last resort**. *Explicit is better than implicit*, and *clear code is better than concise code*.

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

Elixir **evaluates function arguments before the call**. It does **not** evaluate the arguments of a macro. The macro receives them as quoted expressions and returns another quoted expression.

<Diagram name="macros/macro-vs-function" caption="The macro rewrites the code. The function sees only results." />

The macro receives and returns these values. Elixir expands it at compile time:

<Diagram name="macros/expansion" caption="A macro is a function from quoted expressions to a quoted expression." />

`Macro.expand_once/2` lets you make sure of this: `Macro.expand_once(expr, __ENV__) |> Macro.to_string()` prints `if(!true) do IO.puts("…") end`.

`if/2` is also a macro, as are `def/2`, `defmacro/2`, and `defprotocol/2`. They are ordinary Elixir. For this reason, you can extend the language for your domain. Only the *special forms* (see `Kernel.SpecialForms`) cannot be overridden.

<UnderTheHood>

**What a macro call becomes.** We compiled the `unless` of the chapter in both ways and read the caller with `:beam_disasm`. For the macro, the caller already holds the expansion: a `select_val` on the condition, and a call to `IO.puts` only on the path that needs it. There is no call to the module of the macro, because the macro ran while the compiler compiled the caller.

For the function, the caller first calls `IO.puts`, because Elixir evaluates arguments before the call. Then it builds the keyword list and calls `fun_unless/2`. This is the difference that the chapter describes, as machine instructions: a macro changes the code that the compiler compiles, and a function receives values at runtime.

<Diagram name="macros/uth-expansion" caption="A macro leaves its result in the caller. A function is called with arguments that Elixir already evaluated." />

*Sources:* we disassembled with `:beam_disasm` on Elixir 1.20 / OTP 29. The instructions that the compiler chooses can be different between compiler versions.

</UnderTheHood>

## Hygiene

Macros have *late resolution*: a variable that you set inside a quote does not clash with a variable in the caller.

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

To touch the variable of the caller on purpose, use `var!/1`:

```elixir
defmacro interference do
  quote do: var!(a) = 1
end
# HygieneTest.go() now returns 1  (with a warning that the original a is not used)
```

<Diagram name="macros/hygiene" caption="Hygiene is a context. var! removes it." />

How it works: each variable carries a **context** in its third element. A variable that you write in the module is `{:x, [line: 3], nil}`. A quoted variable, from inside `Sample`, is `{:x, [line: 3], Sample}`:

```elixir
defmodule Sample do
  def quoted do
    quote do: x
  end
end

Sample.quoted()   #=> {:x, [line: 3], Sample}
```

Different contexts make different variables. The same mechanism covers imports and aliases. You can bypass it with `var!/2` and `alias!/1` (be careful).

For variables with names that you build dynamically, use `Macro.var/2`:

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

The second argument to `Macro.var/2` is the **context**. It decides hygiene, as described above. `Macro.unique_var/2` makes new names.

## The environment

`__ENV__/0` returns a `Macro.Env` struct that describes the compile-time environment: the current module, the file, the line, the variables in scope, the imports, and the requires. Many `Macro` functions take one, for example `Macro.expand_once/2`.

## Private macros

`defmacrop` defines a macro that you can use only inside its module, at compile time. You must **define a macro before you use it**. If not, Elixir does not expand the call, and it becomes a call to a missing function (`CompileError: function two/0 undefined`).

## Write macros with care

- **Hygienic:** variables, function calls, and aliases inside a macro do not leak into the caller.
- **Lexical:** nothing is injected globally. You must `require` or `import` the module that defines the macro.
- **Explicit:** a macro runs only where you call it. It does not rewrite other functions in a hidden way.
- **Clear language:** `quote` and `unquote` are written out, so the boundaries of a macro are visible.

Even so, macros are not your API. Keep the quoted part **minimal** and put the real work in a function:

```elixir
defmacro my_macro(a, b, c) do
  quote do
    MyModule.do_this_that_and_that(unquote(a), unquote(b), unquote(c))
  end
end

def do_this_that_and_that(a, b, c), do: ...
```

<Diagram name="macros/thin-macro" caption="The function is easy to test, and people who do not want the macro can use it." />

# Modules and functions

Source: [Elixir guide, Modules and functions](https://elixir.hexdocs.pm/modules-and-functions.html).

`defmodule` groups functions. The module name (an *alias*) starts with an uppercase letter. Function names start with a lowercase letter or `_`.

```elixir
defmodule Math do
  def sum(a, b) do
    a + b
  end
end

Math.sum(1, 2)   #=> 3
```

## Scripting

The compiler compiles `.ex` files. `.exs` files are scripts. Elixir treats them in the same way. The difference is the intent. Run a script with `elixir math.exs`, or load it into a shell with `iex math.exs`.

## Public and private

Other modules can call a `def` function. A `defp` function is private to the module.

<Diagram name="modules-and-functions/visibility" caption="Only def functions cross the boundary of the module." />

```elixir
defmodule Math do
  def sum(a, b) do
    do_sum(a, b)
  end

  defp do_sum(a, b) do
    a + b
  end
end

Math.sum(1, 2)      #=> 3
Math.do_sum(1, 2)   #=> ** (UndefinedFunctionError)
```

<UnderTheHood>

**In short:** a call inside a module is a jump and a call to another module is a lookup. The VM reads a module from disk the first time that it needs it.

**Two kinds of call.** A call to a function in the same module, such as `do_sum(a, b)`, is a jump inside the code of the module.

A call to another module, such as `Math.sum(1, 2)`, goes through the table of imports of the module. The VM finds the function among the *exports* of the other module. Only `def` functions are exports: `module_info(:exports)` listed `sum/2` but not the private `do_sum/2`. A default argument adds an export: `join(a, b, sep \\ " ")` exported both `join/2` and `join/3`.

**Where the module comes from.** A module is not in memory until the VM first needs it. In a script that called a module through `apply/3`, `:erlang.module_loaded/1` was `false` before the first call. The trace showed that the VM opened `Elixir.Math.beam` between two marker lines that we printed around the call. The VM read the file from disk at the first call, and the module stays in memory after that.

<Diagram name="modules-and-functions/uth-calls" caption="A local call is a jump. A call to another module goes through its exports, and loads the module first if necessary." />

*Sources:* we read the instructions with `:beam_disasm` (`call_only` for a call inside the module, `call_ext_only` for a call to another module). We observed the loading with `strace -f -e trace=openat,writev` on Erlang/OTP 29 and Elixir 1.20. Elixir can load a module before the first call, for example when the compiler checks a call in a script.

</UnderTheHood>

## Clauses and guards

A function can have several clauses. Elixir tries them from top to bottom and runs the first clause that matches. If no clause matches, Elixir raises `FunctionClauseError`.

```elixir
defmodule Math do
  def zero?(0), do: true
  def zero?(x) when is_integer(x), do: false
end

Math.zero?(0)          #=> true
Math.zero?(1)          #=> false
Math.zero?([1, 2, 3])  #=> ** (FunctionClauseError)
```

<Diagram name="modules-and-functions/clauses" caption="The same top-to-bottom matching as case." />

By convention, a trailing `?` means that the function returns a boolean. `do:` is acceptable for one-line functions. Use `do` blocks for longer functions.

## Default arguments

```elixir
def join(a, b, sep \\ " "), do: a <> sep <> b
```

Elixir evaluates the default **each time it uses the default**, not when it defines the function:

```elixir
defmodule DefaultTest do
  def dowork(x \\ "hello") do
    x
  end
end

DefaultTest.dowork()      #=> "hello"
DefaultTest.dowork(123)   #=> 123
DefaultTest.dowork()      #=> "hello"
```

When a function has several clauses, declare the defaults once in a *function head*, a function without a body. A function head cannot have patterns or guards:

```elixir
def join(a, b, sep \\ " ")
def join(a, b, _sep) when b == "", do: a
def join(a, b, sep), do: a <> sep <> b
```

## Aliases are atoms

A name that starts with a capital letter, such as `String`, is an *alias*. At compile time, it becomes an atom: `String` is `:"Elixir.String"`. Modules on the Erlang VM are always atoms. The `Elixir.` prefix prevents clashes between Elixir modules and Erlang modules. You call Erlang in the same way: `:lists.flatten([1, [2], 3])`.

<Diagram name="modules-and-functions/aliases" caption="Elixir modules are atoms with a namespace. Erlang modules are plain atoms." />

## Nesting

`defmodule Foo do defmodule Bar do end end` defines two independent modules, `Foo` and `Foo.Bar`. Inside `Foo`, you can write `Bar`. Outside `Foo`, you need the full name or an `alias`. `Foo` does not need to exist before `Foo.Bar`.

# Modules and functions

Source: [Elixir guide, Modules and functions](https://elixir.hexdocs.pm/modules-and-functions.html).

`defmodule` groups functions. The module name (an *alias*) starts with an uppercase letter,
function names with lowercase or `_`.

```elixir
defmodule Math do
  def sum(a, b) do
    a + b
  end
end

Math.sum(1, 2)   #=> 3
```

## Scripting

`.ex` files are compiled. `.exs` files are scripts. Elixir treats them the same, the difference is intent.
Run one with `elixir math.exs`, or load it into a shell with `iex math.exs`.

## Public and private

`def` is callable from other modules. `defp` is private to the module.

<Diagram name="modules-and-functions/visibility" caption="Only def functions cross the module boundary." />

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

**In short:** a call inside a module is a jump, a call to another module is looked up, and a module is read from disk the first time it is needed.

**Two kinds of call.** A call to a function in the same module, such as `do_sum(a, b)`, is a jump inside the module's own code.

A call to another module, such as `Math.sum(1, 2)`, goes through the module's table of imports, and the VM finds the function among the other module's *exports*. Only `def` functions are exported: `module_info(:exports)` listed `sum/2` but not the private `do_sum/2`. A default argument adds an export: `join(a, b, sep \\ " ")` exported both `join/2` and `join/3`.

**Where the module comes from.** A module isn't in memory until it is first needed. In a script that called a module through `apply/3`, `:erlang.module_loaded/1` was `false` before the first call. Tracing showed the VM opening `Elixir.Math.beam` between two marker lines printed around the call: it read the file from disk at the first call, and the module stays in memory after that.

<Diagram name="modules-and-functions/uth-calls" caption="A local call is a jump. A call to another module goes through its exports, loading it first if needed." />

*Sources:* instructions read with `:beam_disasm` (`call_only` for a call inside the module, `call_ext_only` for a call to another), loading observed with `strace -f -e trace=openat,writev` on Erlang/OTP 29 and Elixir 1.20. Elixir may load a module earlier than the first call, for example when the compiler checks a call in a script.

</UnderTheHood>

## Clauses and guards

A function can have several clauses. Elixir tries them top to bottom and runs the first that
matches. No match raises `FunctionClauseError`.

```elixir
defmodule Math do
  def zero?(0), do: true
  def zero?(x) when is_integer(x), do: false
end

Math.zero?(0)          #=> true
Math.zero?(1)          #=> false
Math.zero?([1, 2, 3])  #=> ** (FunctionClauseError)
```

<Diagram name="modules-and-functions/clauses" caption="Same top-to-bottom matching as case." />

A trailing `?` conventionally means the function returns a boolean. `do:` is fine for one-liners,
use `do` blocks for anything longer.

## Default arguments

```elixir
def join(a, b, sep \\ " "), do: a <> sep <> b
```

The default is evaluated **each time it's used**, not when the function is defined:

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

With several
clauses, declare defaults once in a body-less *function head*, which can't have patterns or guards:

```elixir
def join(a, b, sep \\ " ")
def join(a, b, _sep) when b == "", do: a
def join(a, b, sep), do: a <> sep <> b
```

## Aliases are atoms

A capitalized name like `String` is an *alias* that becomes an atom at compile time:
`String` is `:"Elixir.String"`. Modules on the Erlang VM are always atoms, and the `Elixir.` prefix keeps
Elixir modules from clashing with Erlang ones. That is also how you call Erlang: `:lists.flatten([1, [2], 3])`.

<Diagram name="modules-and-functions/aliases" caption="Elixir modules are namespaced atoms. Erlang modules are plain atoms." />

## Nesting

`defmodule Foo do defmodule Bar do end end` defines two independent modules, `Foo` and `Foo.Bar`.
Inside `Foo` you can write `Bar`. Outside you need the full name or an `alias`. `Foo` doesn't have to
exist before `Foo.Bar`.

# alias, require, import, and use

Source: [Elixir guide, alias, require, import, and use](https://elixir.hexdocs.pm/alias-require-and-import.html).

Elixir has three directives and one macro to reuse code. The first three have **lexical scope**.

| Directive | What it does |
|---|---|
| `alias Foo.Bar, as: Bar` | Refer to `Foo.Bar` as `Bar` |
| `require Foo` | Allow the use of the macros of `Foo` |
| `import Foo` | Call the functions of `Foo` without the `Foo.` prefix |
| `use Foo` | Let `Foo` inject code into your module |

## alias

`alias Math.List` is short for `alias Math.List, as: List`. By default, the alias is the last part of the name. The original module is still available as `Elixir.List`.

## Lexical scope

Each directive is valid from the place where it appears to the end of its enclosing block. If you put a directive inside a function, only that function sees it.

<Diagram name="alias-require-and-import/lexical" caption="An alias inside plus/2 does not reach minus/2." />

## require

Elixir expands macros at compile time, so you must require a module to use its macros.

```elixir
Integer.is_odd(3)
#=> ** (UndefinedFunctionError) ... there is a macro with the same name and arity. Be sure to require Integer
require Integer
Integer.is_odd(3)   #=> true
```

## import

`import` lets you call public functions or macros without the prefix. To keep the scope small, use `:only` (or `:except`):

```elixir
import List, only: [duplicate: 2]
duplicate(:ok, 3)   #=> [:ok, :ok, :ok]
```

You cannot import private functions. In your own code, prefer `alias`. It shows clearly where a function comes from.

## use

`use` is an extension point. It requires the module and then calls its `__using__/1` macro, which can inject any code. `use ExUnit.Case`, `use GenServer`, and `use Supervisor` work in this way.

<Diagram name="alias-require-and-import/use-expands" caption="use is require plus a call to __using__/1." />

`use` can run any code. Read the docs of the module that you use. Do not use `use` where `import` or `alias` is enough.

## Several at once

```elixir
alias MyApp.{Foo, Bar, Baz}
```

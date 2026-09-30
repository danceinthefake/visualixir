# alias, require, import, and use

Source: [Elixir guide, alias, require, import, and use](https://elixir.hexdocs.pm/alias-require-and-import.html).

Three directives and one macro for reusing code. The first three have **lexical scope**.

| Directive | What it does |
|---|---|
| `alias Foo.Bar, as: Bar` | Refer to `Foo.Bar` as `Bar` |
| `require Foo` | Allow using `Foo`'s macros |
| `import Foo` | Call `Foo`'s functions without the `Foo.` prefix |
| `use Foo` | Let `Foo` inject code into your module |

## alias

`alias Math.List` is short for `alias Math.List, as: List`: the alias defaults to the last part of the name. The
original stays reachable as `Elixir.List`.

## Lexical scope

Each directive is valid only from where it appears to the end of its enclosing block. Put it inside a function
and only that function sees it.

<Diagram name="alias-require-and-import/lexical" caption="An alias inside plus/2 doesn't reach minus/2." />

## require

Macros are expanded at compile time, so you opt in to a module's macros by requiring it.

```elixir
Integer.is_odd(3)
#=> ** (UndefinedFunctionError) ... there is a macro with the same name and arity. Be sure to require Integer
require Integer
Integer.is_odd(3)   #=> true
```

## import

`import` lets you call public functions or macros without the prefix. Prefer `:only` (or `:except`) to keep
the scope small:

```elixir
import List, only: [duplicate: 2]
duplicate(:ok, 3)   #=> [:ok, :ok, :ok]
```

Private functions can't be imported. In your own code prefer `alias`, which keeps it clear where a function comes from.

## use

`use` is an extension point. It requires the module, then calls its `__using__/1` macro, which can inject anything.
`use ExUnit.Case`, `use GenServer` and `use Supervisor` work this way.

<Diagram name="alias-require-and-import/use-expands" caption="use is require plus a call to __using__/1." />

`use` can run arbitrary code, so read the docs of what you use, and don't reach for it where `import` or `alias` would do.

## Several at once

```elixir
alias MyApp.{Foo, Bar, Baz}
```

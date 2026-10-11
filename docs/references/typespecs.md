# Typespecs reference

Source: [Elixir reference, Typespecs reference](https://elixir.hexdocs.pm/typespecs.html).

> **Typespecs are not set-theoretic types.** Elixir is building its own type system on [set-theoretic types](./gradual-set-theoretic-types). Typespecs are a different notation that is based on Erlang. The language can phase them out as that effort moves forward.

Elixir is dynamically typed, and the compiler never uses typespecs to optimize code. They are still useful as documentation (ExDoc shows them) and for tools such as Dialyzer.

## Attributes

<Diagram name="typespecs/attributes" caption="Which attribute defines what." />

`@typedoc` documents a custom `@type`.

## A simple example

```elixir
defmodule StringHelpers do
  @typedoc "A word from the dictionary"
  @type word() :: String.t()

  @spec long_word?(word()) :: boolean()
  def long_word?(word) when is_binary(word) do
    String.length(word) > 8
  end
end
```

## Types and syntax

The syntax follows the syntax of Erlang. Parameterized types (`list(integer)`) and remote types (`Enum.t()`) work. Integer and atom literals are types (`1`, `:atom`, `false`), and all other types are a union. The union operator is `|`: `type :: atom() | pid() | tuple()`.

The types below do not map one-to-one to the new set-theoretic types. For example, there are no plans for subsets of `integer()`, and set-theoretic types support intersections and negations.

### Basic types

`any()` is the top type (all terms) and `none()` is the bottom type (no terms). The other basic types are `atom()`, `map()`, `pid()`, `port()`, `reference()`, `tuple()`, `float()`, and `integer()`.

<Diagram name="typespecs/integers" caption="The subtypes of integer." />

Lists are `list(type)` (proper), `nonempty_list(type)`, `maybe_improper_list(content, termination)`, `nonempty_improper_list(content, termination)`, and `nonempty_maybe_improper_list(content, termination)`.

### Literals

| Group | Syntax |
|---|---|
| Atoms | `:atom`, `true`, `false`, `nil` |
| Bitstrings | `<<>>`, `<<_::size>>`, `<<_::_*unit>>`, `<<_::size, _::_*unit>>` (unit 1 to 256) |
| Functions | `(-> type)`, `(type1, type2 -> type)`, `(... -> type)` |
| Integers | `1`, `1..10` |
| Lists | `[type]`, `[]`, `[...]` (non-empty any), `[type, ...]` (non-empty), `[key: value_type]` |
| Maps | `%{}` (empty), `%{key: value_type}`, `%{key_type => value_type}`, `%{required(k) => v}`, `%{optional(k) => v}` |
| Structs | `%SomeStruct{}`, `%SomeStruct{key: value_type}` |
| Tuples | `{}`, `{:ok, type}` |

### Built-in types

| Type | Defined as |
|---|---|
| `term()` | `any()` |
| `arity()` | `0..255` |
| `as_boolean(t)` | `t` (shows that Elixir treats the value as truthy or falsy) |
| `binary()` | `<<_::_*8>>` |
| `nonempty_binary()` | `<<_::8, _::_*8>>` |
| `bitstring()` | `<<_::_*1>>` |
| `nonempty_bitstring()` | `<<_::1, _::_*1>>` |
| `boolean()` | `true \| false` |
| `byte()` | `0..255` |
| `char()` | `0..0x10FFFF` |
| `charlist()` | `[char()]` |
| `nonempty_charlist()` | `[char(), ...]` |
| `fun()`, `function()` | `(... -> any)` |
| `identifier()` | `pid() \| port() \| reference()` |
| `iodata()` | `iolist() \| binary()` |
| `iolist()` | `maybe_improper_list(byte() \| binary() \| iolist(), binary() \| [])` |
| `keyword()` | `[{atom(), any()}]` |
| `keyword(t)` | `[{atom(), t}]` |
| `list()` | `[any()]` |
| `nonempty_list()` | `nonempty_list(any())` |
| `maybe_improper_list()` | `maybe_improper_list(any(), any())` |
| `nonempty_maybe_improper_list()` | `nonempty_maybe_improper_list(any(), any())` |
| `mfa()` | `{module(), atom(), arity()}` |
| `module()`, `node()` | `atom()` |
| `no_return()` | `none()` |
| `number()` | `integer() \| float()` |
| `struct()` | `%{:__struct__ => atom(), optional(atom()) => any()}` |
| `timeout()` | `:infinity \| non_neg_integer()` |

`as_boolean(t)` marks a value that Elixir treats as boolean (`nil` and `false` are false). For example, `filter(t, (element -> as_boolean(term))) :: list`.

### Remote types

Modules define their own types. You refer to them as `Range.t/0` or `String.t/0`.

### Maps

Key types can overlap, and the leftmost type wins. A value with a key that is not in the allowed keys is not of the type. To allow other keys, end with `optional(any) => any`. Note that `map()` is `%{optional(any) => any}`, and `%{}` is only the empty map.

### Keyword lists

In addition to `keyword()` and `keyword(t)`, compose a spec for the options that you expect. None of them is required, and the order does not matter:

```elixir
@type option :: {:name, String.t} | {:max, pos_integer} | {:min, pos_integer}
@type options :: [option()]

@type option :: {:my_option, String.t()} | GenServer.option()   # combines with other types
```

`[{:name, String.t} | …]` and `[name: String.t, max: pos_integer, …]` are equivalent.

### User-defined types

```elixir
@type type_name :: type      # public
@typep type_name :: type     # private
@opaque type_name :: type    # public, the structure is hidden
@type dict(key, value) :: [{key, value}]   # parameterized
```

## Specifications

```elixir
@spec function_name(type1, type2) :: return_type
@spec function(arg) :: [arg] when arg: atom
@spec function(arg1, arg2) :: {arg1, arg2} when arg1: atom, arg2: integer
@spec function(arg) :: [arg] when arg: var
@spec days_since_epoch(year :: integer, month :: integer, day :: integer) :: integer
```

`when` guards restrict type variables. They work only with `@spec`, `@callback`, and `@macrocallback`. `var` is an unrestricted type variable. Named arguments help the documentation. You can overload specs, as you overload functions (`@spec function(integer) :: atom` and `@spec function(atom) :: integer`).

## Behaviours

A behaviour separates the generic part of a component (the *behaviour module*) from the specific part (the *callback modules*). It defines the **callbacks** that the implementers must export. `GenServer` hides message passing and error reporting, and you supply the actions.

```elixir
defmodule Parser do
  @callback parse(String.t) :: {:ok, term} | {:error, atom}
  @callback extensions() :: [String.t]
end

defmodule JSONParser do
  @behaviour Parser

  @impl Parser
  def parse(str), do: {:ok, "some json " <> str}

  @impl Parser
  def extensions, do: [".json"]
end
```

A callback is a function name plus a spec: the name, the arguments, and the expected return type. A missing callback gives a warning at compile time. `@impl` also makes the compiler check that you implement the **correct** callback. A typo such as `def parse` (arity 0) gives a warning that `parse/0` was implemented and not `parse/1`.

<Diagram name="typespecs/behaviour" caption="A behaviour is a contract. Callers call back into any implementation." />

Behaviours let you pass modules around and call `parser.parse(contents)` on the module that fits. For example, here is a function that picks a parser by file extension:

```elixir
@spec parse_path(Path.t(), [module()]) :: {:ok, term} | {:error, atom}
def parse_path(filename, parsers) do
  with {:ok, ext} <- parse_extension(filename),
       {:ok, parser} <- find_parser(ext, parsers),
       {:ok, contents} <- File.read(filename) do
    parser.parse(contents)
  end
end

defp parse_extension(filename) do
  if ext = Path.extname(filename) do
    {:ok, ext}
  else
    {:error, :no_extension}
  end
end

defp find_parser(ext, parsers) do
  if parser = Enum.find(parsers, fn parser -> ext in parser.extensions() end) do
    {:ok, parser}
  else
    {:error, :no_matching_parser}
  end
end
```

You can also call a parser directly: `CSVParser.parse(...)`. You do not need a behaviour to dispatch dynamically on a module, but they often go together.

### Optional callbacks

```elixir
defmodule MyBehaviour do
  @callback vital_fun() :: any
  @callback non_vital_fun() :: any
  @macrocallback non_vital_macro(arg :: any) :: Macro.t
  @optional_callbacks non_vital_fun: 0, non_vital_macro: 1
end
```

The behaviour module checks if an optional callback exists, with `function_exported?/3` or `macro_exported?/3`. These functions do not load the module, so call `Code.ensure_loaded?/1` first. `GenServer.format_status/1` is one example.

### Look inside behaviours

`@callback` and `@optional_callbacks` define `behaviour_info/1`: `MyBehaviour.behaviour_info(:callbacks)` and `behaviour_info(:optional_callbacks)`. In IEx, you can also use `b/1`.

## Pitfalls

- **`string()`:** it refers to an Erlang string (an Elixir *charlist*), not an Elixir string. Elixir gives a warning if you use it. Use `charlist()`, `nonempty_charlist()`, `binary()`, or `String.t()`. Tools see `String.t()` and `binary()` as equivalent, but `String.t()` tells readers that the string is UTF-8.
- **Functions that raise:** specs do not need to say that a function can raise an error, because any function can fail on bad input. `no_return()` is for functions that **never return**: an endless `receive` loop, a function that always raises an error, or a function that shuts down the VM. Do not use it for functions with side effects such as `IO.puts/1`, whose return type is `:ok`.

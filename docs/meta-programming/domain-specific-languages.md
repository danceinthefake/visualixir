# Domain-Specific Languages (DSLs)

Source: [Elixir guide, Domain-Specific Languages (DSLs)](https://elixir.hexdocs.pm/domain-specific-languages.html).

A DSL is a language for one domain. You do not need macros to make one. Every function and data structure that you define is part of the language of your domain. You can build a `Validator` in three ways:

```elixir
# 1. Data structures
validate user, name: [length: 1..100], email: [matches: ~r/@/]

# 2. Functions
user
|> validate_length(:name, 1..100)
|> validate_matches(:email, ~r/@/)

# 3. Macros and modules
defmodule MyValidator do
  use Validator
  validate_length :name, 1..100
  validate_matches :email, ~r/@/
end
```

<Diagram name="domain-specific-languages/options" caption="data, then functions, then macros: prefer them in this order." />

Data is the most flexible and the easiest to compose, because the standard library has many functions for it. Functions suit complex APIs and read well with `|>`. Macros are the most complex. They need more code, they are hard and costly to test, and they limit how users call you (everything must be inside a module). To validate an attribute *only if a condition holds* is simple with data or functions. It is impossible with the macro DSL unless you extend it.

Macros and modules still have a place. The rest of this chapter builds a DSL with them.

## The goal: a test case

```elixir
defmodule MyTest do
  use TestCase

  test "arithmetic operations" do
    4 = 2 + 2
  end

  test "list operations" do
    [1, 2, 3] = [1, 2] ++ [3]
  end
end

MyTest.run()
```

`test` defines a function and `run` runs all of them. The assertions are the match operator.

## The test macro

`use TestCase` calls the `__using__/1` macro. The macro returns code that Elixir injects into the module of the user:

```elixir
defmodule TestCase do
  defmacro __using__(_opts) do
    quote do
      import TestCase
    end
  end

  defmacro test(description, do: block) do
    function_name = String.to_atom("test " <> description)
    quote do
      def unquote(function_name)(), do: unquote(block)
    end
  end
end
```

<Diagram name="domain-specific-languages/test-macro" caption="test receives quoted code and returns quoted code that defines a function." />

`MyTest."test hello"()` now runs that test and raises `MatchError` for `"hello" = "world"`. There is not yet a way to run all the tests.

## Store information with attributes

You can list the tests with `__MODULE__.__info__(:functions)`, but a module attribute, as temporary storage, can hold more for each test. `__using__/1` starts `@tests` as `[]`. Each `test` adds its name at the front. `@before_compile` injects `run/0` when the module is complete:

```elixir
defmacro __using__(_opts) do
  quote do
    import TestCase
    @tests []
    @before_compile TestCase
  end
end

defmacro test(description, do: block) do
  function_name = String.to_atom("test " <> description)
  quote do
    @tests [unquote(function_name) | @tests]
    def unquote(function_name)(), do: unquote(block)
  end
end

defmacro __before_compile__(_env) do
  quote do
    def run do
      Enum.each(@tests, fn name ->
        IO.puts("Running #{name}")
        apply(__MODULE__, name, [])
      end)
    end
  end
end
```

<Diagram name="domain-specific-languages/test-case-flow" caption="Set up, collect while the module compiles, and then generate run/0." />

This is the main idea of DSLs in Elixir. Macros return quoted code that runs in the caller. Module attributes hold what you collect. `@before_compile` adds code when the definition is complete. `@on_definition` and `@after_compile` are related hooks (see `Module`).

# Domain-Specific Languages (DSLs)

Source: [Elixir guide, Domain-Specific Languages (DSLs)](https://elixir.hexdocs.pm/domain-specific-languages.html).

A DSL is a language tailored to one domain. You don't need macros for one: every function and data structure you define is part of your domain's language. A
`Validator` could be built three ways:

```elixir
# 1. Data structures
validate user, name: [length: 1..100], email: [matches: ~r/@/]

# 2. Functions
user
|> validate_length(:name, 1..100)
|> validate_matches(:email, ~r/@/)

# 3. Macros + modules
defmodule MyValidator do
  use Validator
  validate_length :name, 1..100
  validate_matches :email, ~r/@/
end
```

<Diagram name="domain-specific-languages/options" caption="data > functions > macros: prefer them in this order." />

Data is the most flexible and easiest to compose, because the standard library is full of functions for it. Functions suit complex APIs and read well with `|>`. Macros
are the most complex: more code, hard and costly to test, and they limit how users call you (everything must sit inside a module). Validating an attribute *only if a
condition holds* is trivial with data or functions and impossible with the macro DSL unless you extend it.

Macros and modules still have their place. The rest of this chapter builds one.

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

`test` defines a function and `run` runs them all. Assertions are just the match operator.

## The test macro

`use TestCase` calls the `__using__/1` macro, which returns code injected into the user's module:

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

`MyTest."test hello"()` now runs that test and raises `MatchError` for `"hello" = "world"`. There is no way to run all of them yet.

## Storing information with attributes

The tests can be listed with `__MODULE__.__info__(:functions)`, but a module attribute, as temporary storage, can hold more per test. `__using__/1` starts
`@tests` as `[]`, each `test` prepends its name, and `@before_compile` injects `run/0` when the module is complete:

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

<Diagram name="domain-specific-languages/test-case-flow" caption="Set up, collect while the module compiles, then generate run/0." />

That is the main idea of DSLs in Elixir: macros return quoted code that runs in the caller, module attributes hold what you collect, and `@before_compile` adds code once the definition is
complete. `@on_definition` and `@after_compile` are related hooks (see `Module`).

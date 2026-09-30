# Writing documentation

Source: [Elixir guide, Writing documentation](https://elixir.hexdocs.pm/writing-documentation.html).

Documentation is first-class in Elixir. It is written in **Markdown**, attached with module attributes, and stored in the compiled bytecode.

<Diagram name="writing-documentation/flow" caption="One source of docs, several consumers." />

## Attributes

```elixir
defmodule MyApp.Hello do
  @moduledoc """
  This is the Hello module.
  """
  @moduledoc since: "1.0.0"

  @doc """
  Says hello to the given `name`.

  ## Examples

      iex> MyApp.Hello.world(:john)
      :ok

  """
  @doc since: "1.3.0"
  def world(name), do: IO.puts("hello #{name}")
end
```

`@moduledoc` documents the module, `@doc` the function after it, `@typedoc` a type.

## Argument names and metadata

Documentation shows argument names the compiler infers, which can be poor on multi-clause functions. Name them with a function head:

```elixir
def size(map_with_size)

def size(%{size: size}), do: size
```

Pass a keyword list to any doc attribute for metadata: `deprecated:` (a warning in the docs only, use `@deprecated "…"` to warn at compile
time as well), `group:` (sidebar grouping in ExDoc and IEx completion) and `since:` (which version added it).

## Recommendations

- Keep the first paragraph to one line: tools use it as a summary.
- Reference modules by full name in backticks (`` `MyApp.Hello` ``), so tools can link them.
- Reference functions as `` `world/1` `` locally, or `` `MyApp.Hello.world/1` `` elsewhere. Use `c:` for callbacks and `t:` for types.
- Sections start at `##`. First-level headers are reserved for module and function names.
- Put the docs before the first clause. They are per function and arity, not per clause.

## Doctests

Examples under `## Examples` starting with `iex>` can be run as tests by ExUnit (`ExUnit.DocTest`), so they can't go stale.

## Documentation is not comments

Docs are a **contract** with the users of your API, who may never see your source. Comments are for people reading the code (a workaround note, a
TODO). A private function's `@doc` is discarded with a warning, but a comment there is welcome.

## Hiding things

| To do this | Use | Still callable? |
|---|---|---|
| hide a module from docs | `@moduledoc false` | yes |
| hide a function from docs | `@doc false` | yes, and it is still imported |
| really make it private | `defp` | no |

`@doc false` doesn't make a function private, so prefer moving the function into a `@moduledoc false` module, or name it with a leading
underscore (`__add__/2`): those are treated as hidden and never imported.

## Reading docs back

`Code.fetch_docs/1` reads them from the bytecode on disk. Modules defined in IEx have no file, so they have no fetchable docs.

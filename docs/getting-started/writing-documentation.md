# Writing documentation

Source: [Elixir guide, Writing documentation](https://elixir.hexdocs.pm/writing-documentation.html).

Documentation is a main feature of Elixir. You write it in **Markdown** and attach it with module attributes. The compiler stores it in the compiled bytecode.

<Diagram name="writing-documentation/flow" caption="One source of docs and several consumers." />

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

`@moduledoc` documents the module, `@doc` documents the function after it, and `@typedoc` documents a type.

## Argument names and metadata

The documentation shows argument names that the compiler infers. These can be poor for functions with several clauses. Name the arguments with a function head:

```elixir
def size(map_with_size)

def size(%{size: size}), do: size
```

Pass a keyword list to any doc attribute for metadata: `deprecated:` (a warning in the docs only. Use `@deprecated "…"` to also warn at compile time), `group:` (sidebar grouping in ExDoc and IEx completion), and `since:` (the version that added it).

## Recommendations

- Keep the first paragraph to one line. Tools use it as a summary.
- Refer to modules by their full name in backticks (`` `MyApp.Hello` ``), so that tools can link them.
- Refer to functions as `` `world/1` `` in the same module, or `` `MyApp.Hello.world/1` `` elsewhere. Use `c:` for callbacks and `t:` for types.
- Sections start at `##`. First-level headers are for the names of modules and functions.
- Put the docs before the first clause. They belong to a function and arity, not to a clause.

## Doctests

ExUnit (`ExUnit.DocTest`) can run examples under `## Examples` that start with `iex>` as tests, so they cannot become out of date.

## Documentation is not comments

Docs are a **contract** with the users of your API. These users can never see your source. Comments are for people who read the code (a note about a workaround, a TODO). Elixir discards the `@doc` of a private function with a warning, but a comment there is welcome.

## Hiding things

| To do this | Use | Can you still call it? |
|---|---|---|
| hide a module from docs | `@moduledoc false` | yes |
| hide a function from docs | `@doc false` | yes, and it is still imported |
| make it really private | `defp` | no |

`@doc false` does not make a function private. Prefer to move the function into a `@moduledoc false` module. Alternatively, name it with a leading underscore (`__add__/2`). Elixir treats these functions as hidden and never imports them.

## Reading docs back

`Code.fetch_docs/1` reads the docs from the bytecode on disk. Modules that you define in IEx have no file, so they have no docs to fetch.

<UnderTheHood>

**Where documentation lives.** The compiled `.beam` file stores the documentation in a chunk named `Docs`. The file `Elixir.Enum.beam` is 187,856 bytes on disk. The code is 49,375 bytes, the debug information (`Dbgi`) is 63,498 bytes, and the documentation is 18,287 bytes, about a tenth. The chapter says that documentation is "not loaded into memory when modules are loaded" and that `Code.fetch_docs/1` reads it from the bytecode on disk. We measured it: `Code.fetch_docs(Enum)` changed `:erlang.memory(:code)` by 0 bytes, so the system keeps nothing in memory.

<Diagram name="writing-documentation/uth-docs-chunk" caption="One .beam file. The code loads into memory. The documentation stays on disk until you ask for it." />

For the same reason, modules that you define in IEx have no docs to fetch: there is no file to read the chunk from.

*Sources:* we took the chunk sizes from `:beam_lib.info/1` on Erlang/OTP 29 and Elixir 1.20. The description of the loading is from the chapter.

</UnderTheHood>

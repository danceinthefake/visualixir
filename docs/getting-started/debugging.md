# Debugging

Source: [Elixir guide, Debugging](https://elixir.hexdocs.pm/debugging.html).

Tools run from lightest to heaviest:

<Diagram name="debugging/tools" caption="Reach for the lightest tool that answers the question." />

## IO.inspect/2

`IO.inspect/2` prints its argument and **returns it unchanged**, so you can drop it anywhere, especially between pipeline steps:

```elixir
(1..10)
|> IO.inspect()
|> Enum.map(fn x -> x * 2 end)
|> IO.inspect()
|> Enum.sum()
|> IO.inspect()
```

<Diagram name="debugging/inspect-pipeline" caption="The dashed lines are output. The main path is untouched." />

Add `label:` to tell prints apart (`IO.inspect(label: "before")`). Combine with `binding/0`, which returns every variable and its value:

```elixir
def some_function(a, b, c) do
  IO.inspect(binding())   #=> [a: :foo, b: "bar", c: :baz]
end
```

## dbg/2

Since Elixir 1.14. Like `IO.inspect/2`, but it also prints the **code and its location**, and in a pipeline it prints **every step**:

```elixir
__ENV__.file
|> String.split("/", trim: true)
|> List.last()
|> File.exists?()
|> dbg()
```

```text
[dbg_pipes.exs:5: (file)]
__ENV__.file #=> "/home/myuser/dbg_pipes.exs"
|> String.split("/", trim: true) #=> ["home", "myuser", "dbg_pipes.exs"]
|> List.last() #=> "dbg_pipes.exs"
|> File.exists?() #=> true
```

## Pry

`iex --dbg pry` (or `iex --dbg pry -S mix` in a project) makes each `dbg` call ask whether to stop. Accept and you get IEx with all
variables, imports and aliases. Execution resumes on `continue`/`c` or advances on `next`/`n`.

## Breakpoints

`dbg` needs code changes. `IEx.break!/2` sets breakpoints on any code **without editing it**. It steps line by line but has no access to
aliases and imports on compiled modules. `mix test` integrates them: `--breakpoints` sets one at the start of every test to run.

```console
$ iex -S mix test --breakpoints --failed
$ iex -S mix test -b path/to/file:line
```

## Observer

For understanding the whole system, use `:observer.start()`. It opens a GUI over the runtime: processes, applications, tracing.

```elixir
iex> :observer.start()
```

Inside a project (`iex -S mix`), first run `Mix.ensure_application!(:observer)`. If it fails, your Erlang was probably installed without
WX (GUI) support, so install the complete package. Phoenix apps get the LiveDashboard for production nodes, and `runtime_info/0` prints a
quick runtime overview in IEx.

## Beyond

`:crashdump_viewer` reads crash dumps. The VM also integrates with OS tracers (LTTng, DTrace, SystemTap), has microstate accounting
(`:msacc`), and Mix ships `profile.cprof` and `profile.fprof` tasks. For advanced cases the guide recommends the free book *Erlang in Anger*.

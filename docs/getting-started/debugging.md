# Debugging

Source: [Elixir guide, Debugging](https://elixir.hexdocs.pm/debugging.html).

The tools are in order from the lightest to the heaviest:

<Diagram name="debugging/tools" caption="Use the lightest tool that answers the question." />

## IO.inspect/2

`IO.inspect/2` prints its argument and **returns it unchanged**. You can put it anywhere, especially between the steps of a pipeline:

```elixir
(1..10)
|> IO.inspect()
|> Enum.map(fn x -> x * 2 end)
|> IO.inspect()
|> Enum.sum()
|> IO.inspect()
```

<Diagram name="debugging/inspect-pipeline" caption="The dashed lines are output. The main path does not change." />

Add `label:` to tell the prints apart (`IO.inspect(label: "before")`). Use it with `binding/0`, which returns every variable and its value:

```elixir
def some_function(a, b, c) do
  IO.inspect(binding())   #=> [a: :foo, b: "bar", c: :baz]
end
```

## dbg/2

`dbg/2` is available since Elixir 1.14. It is like `IO.inspect/2`, but it also prints the **code and its location**. In a pipeline, it prints **every step**:

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

`iex --dbg pry` (or `iex --dbg pry -S mix` in a project) makes each `dbg` call ask if it must stop. If you accept, you get IEx with all variables, imports, and aliases. Enter `continue` or `c` to resume the execution. Enter `next` or `n` to go to the next step.

## Breakpoints

`dbg` needs changes to the code. `IEx.break!/2` sets breakpoints on any code **without a change to it**. It steps line by line, but on compiled modules it has no access to aliases and imports. `mix test` integrates breakpoints: `--breakpoints` sets one at the start of every test that runs.

```console
$ iex -S mix test --breakpoints --failed
$ iex -S mix test -b path/to/file:line
```

## Observer

To understand the whole system, use `:observer.start()`. It opens a GUI over the runtime: processes, applications, and tracing.

```elixir
iex> :observer.start()
```

Inside a project (`iex -S mix`), first run `Mix.ensure_application!(:observer)`. If this fails, your Erlang installation probably has no WX (GUI) support. In that case, install the complete package. Phoenix applications have the LiveDashboard for production nodes. `runtime_info/0` prints a quick runtime overview in IEx.

## Beyond

`:crashdump_viewer` reads crash dumps. The VM also integrates with OS tracers (LTTng, DTrace, SystemTap) and has microstate accounting (`:msacc`). Mix has the tasks `profile.cprof` and `profile.fprof`. For advanced cases, the guide recommends the free book *Erlang in Anger*.

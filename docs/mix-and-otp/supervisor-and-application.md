# Registries and supervision trees

Source: [Elixir guide, Registries and supervision trees](https://elixir.hexdocs.pm/supervisor-and-application.html).

The client refers to buckets by name (`PUT shopping milk 1`), so processes need names. Naming them with atoms works
(`KV.Bucket.start_link(name: :shopping)`) but is a terrible idea for dynamic names: **never convert user input to atoms**. Atoms aren't garbage
collected, so users could exhaust the VM's atom limit or memory.

## Registry

`Registry` is a single-node registry that accepts **any Elixir value** as a name. Pass a `:via` tuple wherever a name is accepted (agents,
supervisors, tasks and other behaviours all support it):

```elixir
Registry.start_link(name: KV, keys: :unique)
name = {:via, Registry, {KV, "shopping"}}
KV.Bucket.start_link(name: name)
KV.Bucket.put(name, "milk", 1)
KV.Bucket.get(name, "milk")   #=> 1
```

<Diagram name="supervisor-and-application/via-registry" caption="The registry maps any term to a pid. Atoms from user input are a memory leak." />

But where should `Registry.start_link/1` be called? In the application.

<UnderTheHood>

**What a Registry is.** `Registry.start_link(keys: :unique, name: UthReg)` created an ETS table named after the registry, of type `:set`. Names and pids live in that table, outside any process heap, and a lookup is an ETS read that copies the pid to the caller (see the ETS section in the Erlang libraries chapter).

<Diagram name="supervisor-and-application/uth-registry" caption="A Registry keeps its names in an ETS table." />

*Sources:* `:ets.all/0` and `:ets.info/2` on Erlang/OTP 29 and Elixir 1.20.

</UnderTheHood>

## Applications

Every Elixir project is an application: Elixir itself is `:elixir`, ExUnit is `:ex_unit`. Each `mix compile` prints `Generated kv app`, which is the file
at `_build/dev/lib/kv/ebin/kv.app`. It's Erlang terms holding the version, the modules, and the applications you depend on.

<Diagram name="supervisor-and-application/app-files" caption="An application is the .beam files, the .app manifest, and a priv folder." />

Customize the `.app` file through `application/0` in `mix.exs`. Applications can be started and stopped, and Mix starts yours and its dependencies for you
(`iex -S mix`, `mix test`). Start one whose dependency isn't running and you get an error:

```elixir
Application.stop(:kv)
Application.stop(:logger)
Application.start(:kv)                #=> {:error, {:not_started, :logger}}
Application.ensure_all_started(:kv)   #=> {:ok, [:logger, :kv]}
```

<Diagram name="supervisor-and-application/start-deps" caption="A dependency must be running before the application that needs it." />

### The application callback

To run code at startup, name a callback module in `mix.exs` with `mod:`:

```elixir
def application do
  [extra_applications: [:logger], mod: {KV, []}]
end
```

The module does `use Application` and implements `start/2`, which must start a supervision tree and return `{:ok, root_supervisor_pid}`:

```elixir
defmodule KV do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Registry, name: KV, keys: :unique}
    ]

    Supervisor.start_link(children, strategy: :one_for_one)
  end
end
```

Don't call `Registry.start_link/1` directly there. Start processes **inside a supervisor**, as a *child specification* (usually `{module, options}`,
often just the module). Children can be supervisors themselves, which is how trees form. Restart with a new `iex -S mix`, because
`recompile()` doesn't reload the tree.

<Diagram name="supervisor-and-application/tree" caption="The callback starts the root supervisor. The supervisor starts its children." />

Supervised processes give you:

- **Introspection**: see every process, its memory and its message queue.
- **Resilience**: the supervisor decides whether and how to restart a failing child.
- **Graceful shutdown**: children stop in the reverse of the order they started.

<UnderTheHood>

**How a supervisor notices a death.** A supervised child is linked to its supervisor, and the supervisor has `trap_exit` set (`Process.info(sup, :trap_exit)` returned `{:trap_exit, true}`). When a process dies, the VM sends an exit signal to every process it is linked to. Normally that kills the receiver too. A process that traps exits gets the signal as a message instead, and the supervisor reacts by starting a new child. Measured, a supervised child that was killed was running again about 150 to 200 microseconds later (146 and 199 in two runs).

<Diagram name="supervisor-and-application/uth-supervision" caption="A link carries the exit signal, and trapping it turns it into a message the supervisor can act on." />

*Sources:* `Process.info/2` and timing on Erlang/OTP 29. The restart time depends on the child and the machine.

</UnderTheHood>

## Project or application?

*Project* is Mix's word: the thing it compiles and tests. *Application* is OTP's word: the thing the runtime starts and stops as a whole.
Our `mix.exs` defines a project that produces the `:kv` application.

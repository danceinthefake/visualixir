# Registries and supervision trees

Source: [Elixir guide, Registries and supervision trees](https://elixir.hexdocs.pm/supervisor-and-application.html).

The client refers to buckets by name (`PUT shopping milk 1`), so the processes need names. You can use atoms as names (`KV.Bucket.start_link(name: :shopping)`). This is a bad idea for dynamic names. **Never convert user input to atoms.** The VM does not garbage collect atoms, so users can use up the atom limit or the memory of the VM.

## Registry

`Registry` is a single-node registry that accepts **any Elixir value** as a name. Pass a `:via` tuple wherever a name is accepted. Agents, supervisors, tasks, and other behaviours support it:

```elixir
Registry.start_link(name: KV, keys: :unique)
name = {:via, Registry, {KV, "shopping"}}
KV.Bucket.start_link(name: name)
KV.Bucket.put(name, "milk", 1)
KV.Bucket.get(name, "milk")   #=> 1
```

<Diagram name="supervisor-and-application/via-registry" caption="The registry maps any term to a pid. Atoms from user input are a memory leak." />

Where must the code call `Registry.start_link/1`? In the application.

<UnderTheHood>

**What a Registry is.** `Registry.start_link(keys: :unique, name: UthReg)` created an ETS table of type `:set`. The table has the name of the registry. The names and pids are in that table, outside the heap of any process. A lookup is an ETS read that copies the pid to the caller (see the ETS section in the Erlang libraries chapter).

<Diagram name="supervisor-and-application/uth-registry" caption="A Registry keeps its names in an ETS table." />

*Sources:* `:ets.all/0` and `:ets.info/2` on Erlang/OTP 29 and Elixir 1.20.

</UnderTheHood>

## Applications

Every Elixir project is an application. Elixir is the application `:elixir`, and ExUnit is the application `:ex_unit`. Each `mix compile` prints `Generated kv app`. This is the file `_build/dev/lib/kv/ebin/kv.app`. It holds Erlang terms for the version, the modules, and the applications that you depend on.

<Diagram name="supervisor-and-application/app-files" caption="An application is the .beam files, the .app manifest, and a priv folder." />

To change the `.app` file, use `application/0` in `mix.exs`. You can start and stop applications. Mix starts your application and its dependencies for you (`iex -S mix`, `mix test`). If you start an application and its dependency is not running, you get an error:

```elixir
Application.stop(:kv)
Application.stop(:logger)
Application.start(:kv)                #=> {:error, {:not_started, :logger}}
Application.ensure_all_started(:kv)   #=> {:ok, [:logger, :kv]}
```

<Diagram name="supervisor-and-application/start-deps" caption="A dependency must run before the application that needs it." />

### The application callback

To run code at startup, name a callback module with `mod:` in `mix.exs`:

```elixir
def application do
  [extra_applications: [:logger], mod: {KV, []}]
end
```

The module calls `use Application` and implements `start/2`. The function `start/2` must start a supervision tree and return `{:ok, root_supervisor_pid}`:

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

Do not call `Registry.start_link/1` directly there. Start processes **inside a supervisor**, as a *child specification*. The specification is usually `{module, options}` or only the module. A child can be a supervisor, and this is how trees form. Start a new `iex -S mix`, because `recompile()` does not reload the tree.

<Diagram name="supervisor-and-application/tree" caption="The callback starts the root supervisor. The supervisor starts its children." />

Supervised processes give you these benefits:

- **Introspection**: you can see every process, its memory, and its message queue.
- **Resilience**: the supervisor decides if and how to restart a child that fails.
- **Graceful shutdown**: the children stop in the reverse of the order in which they started.

<UnderTheHood>

**How a supervisor notices a death.** A supervised child is linked to its supervisor, and the supervisor has `trap_exit` set (`Process.info(sup, :trap_exit)` returned `{:trap_exit, true}`). When a process dies, the VM sends an exit signal to every process that is linked to it. Normally the signal also kills the receiver. A process that traps exits gets the signal as a message instead. The supervisor then starts a new child. In our measurement, a killed supervised child ran again about 150 to 200 microseconds later (146 and 199 in two runs).

<Diagram name="supervisor-and-application/uth-supervision" caption="A link carries the exit signal. When the supervisor traps the signal, it becomes a message that the supervisor can act on." />

*Sources:* `Process.info/2` and timing on Erlang/OTP 29. The restart time depends on the child and on the machine.

</UnderTheHood>

## Project or application?

*Project* is the word of Mix for the thing that Mix compiles and tests. *Application* is the word of OTP for the thing that the runtime starts and stops as a whole. Our `mix.exs` defines a project that produces the `:kv` application.

---
source: https://elixir.hexdocs.pm/Supervisor.html
---

# Supervisor

Source: [Elixir docs, Supervisor](https://elixir.hexdocs.pm/Supervisor.html).

A supervisor is a process that supervises other processes, its **children**. Supervisors build a hierarchy that is called a *supervision tree*. The tree gives you fault tolerance and decides how your application starts and shuts down. You start a supervisor with a list of child specifications through `start_link/2`, or you define a module-based supervisor that implements the callbacks.

```elixir
children = [
  # The Counter is a child started via Counter.start_link(0)
  %{id: Counter, start: {Counter, :start_link, [0]}}
]

{:ok, pid} = Supervisor.start_link(children, strategy: :one_for_one)

Supervisor.count_children(pid)
#=> %{active: 1, specs: 1, supervisors: 0, workers: 1}
```

If the registered `Counter` crashes (the docs bump it with a value that is not a number), the supervisor starts a new one. The new one has its initial value `0`.

## Child specification

A child spec is a map. `:id` and `:start` are required, and the other keys are optional:

| Key | Meaning | Default |
|---|---|---|
| `:id` | any term that identifies the spec inside the supervisor. Conflicting ids stop a supervisor from initializing (a `DynamicSupervisor` allows them) | the module |
| `:start` | `{module, function, args}` that starts the child | required |
| `:restart` | when the supervisor restarts a terminated child | `:permanent` |
| `:shutdown` | how to terminate the child | `5_000` for a worker, `:infinity` for a supervisor |
| `:type` | `:worker` or `:supervisor` | `:worker` |
| `:modules` | modules that hot code upgrade uses, set automatically from `:start` | rarely changed |
| `:significant` | counts for automatic shutdown. Only `:transient` and `:temporary` children can be significant | `false` |

### Restart values

<Diagram name="supervisor/restart" caption="The restart value decides what counts as a successful termination." />

The supervisor always restarts a `:permanent` child. It never restarts a `:temporary` child, whatever the strategy. Any termination of it, including an abnormal one, counts as successful. It restarts a `:transient` child only if the child ends with a reason other than `:normal`, `:shutdown`, or `{:shutdown, term}`.

### Shutdown values

`:brutal_kill` terminates the child at once with `Process.exit(child, :kill)`. An integer `>= 0` is the number of milliseconds that the supervisor waits after it sends `Process.exit(child, :shutdown)`. A child that does not trap exits ends immediately. A child that traps exits has that time, and then the supervisor kills it. `:infinity` waits forever and is recommended for a child that is itself a supervisor. For a regular worker, avoid it and take extreme care. The child can never terminate, so your application can never terminate either.

## Strategies and options

`start_link/2` takes the children and these options:

| Option | Meaning | Default |
|---|---|---|
| `:strategy` | `:one_for_one`, `:rest_for_one` or `:one_for_all` | required |
| `:max_restarts` | the most restarts that the supervisor allows in the time frame | `3` |
| `:max_seconds` | the time frame for `:max_restarts` | `5` |
| `:auto_shutdown` | `:never`, `:any_significant` or `:all_significant` | `:never` |
| `:name` | the name to register the supervisor with, with the same rules as for `GenServer` | none |

<Diagram name="supervisor/strategies" caption="Which children restart when B crashes." />

`:one_for_one` restarts only the terminated child. `:one_for_all` terminates all the other children and then restarts all children, including the terminated child. `:rest_for_one` terminates and restarts the terminated child and the children that **started after it**. "Terminated" here means an unsuccessful termination, as `:restart` decides. For children that start dynamically, see `DynamicSupervisor`.

<UnderTheHood>

**In short:** a supervisor restarts a child by starting a new process, so a restarted child has a new pid. If you compare pids, you see exactly which children restarted.

**Strategies.** We started three `GenServer` children `A`, `B`, and `C` in that order, and made `B` crash. We compared the pid of each child before and after. With `:one_for_one`, only `B` had a new pid. With `:rest_for_one`, `B` and `C` had new pids. With `:one_for_all`, all three had new pids.

**Restart intensity.** We used one child and the defaults (3 restarts in 5 seconds). When we crashed the child repeatedly, the supervisor itself exited with reason `:shutdown` at about 155 ms, after the 4th crash. Its child was gone too.

**Shutdown.** We started three children: `x`, `y`, and a stubborn child that trapped exits and slept 10 seconds in `terminate/2`, with `shutdown: 300`. `Supervisor.stop/1` ended the children in the reverse order of the list (stubborn, `y`, `x`), and the whole stop took **301 ms**. The stubborn child had the full 300 ms and then the supervisor killed it.

<Diagram name="supervisor/uth-strategies" caption="The pids after B crashed, compared." />

*Sources:* we compared the `Process.whereis/1` pids before and after, and recorded the `terminate/2` calls with `send/2`, on Elixir 1.20.4 with Erlang/OTP 29. The timings (155 ms, 301 ms) change from machine to machine.

</UnderTheHood>

### Restart intensity

If the supervisor exceeds `:max_restarts` within `:max_seconds`, it **exits with `:shutdown`**. Its own parent then decides what happens next. The parent restarts it only if its child spec says `:permanent` (the default).

<Diagram name="supervisor/intensity" caption="A supervisor that restarts too often fails upward." />

### Automatic shutdown

A supervisor can shut itself down when `:significant` children exit. `:never` is the default. With `:any_significant`, the supervisor shuts down its children and then itself when any significant child exits. With `:all_significant`, it does so when all significant children exit. A significant `:transient` child must exit normally to count. A `:temporary` child can exit for any reason.

## Module-based supervisors

```elixir
defmodule MyApp.Supervisor do
  # Automatically defines child_spec/1
  use Supervisor

  def start_link(init_arg) do
    Supervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    children = [{Counter, 0}]
    Supervisor.init(children, strategy: :one_for_one)
  end
end
```

The `init/1` callback must call `Supervisor.init/2`, which takes `:strategy`, `:max_restarts`, and `:max_seconds`. `use Supervisor` sets `@behaviour Supervisor` and defines `child_spec/1`, so the module can be a child of another supervisor. In that spec, `:id` defaults to the module and `:restart` defaults to `:permanent`. The guideline is to use a supervisor **without** a callback module only at the top of your tree, usually in `c:Application.start/2`. Use module-based supervisors elsewhere.

## Start and shutdown

The supervisor starts children **in the order listed**. It calls the `:start` function of each child, typically `start_link/1`. This function must return `{:ok, pid}` for a new process that is linked to the supervisor. The shutdown happens in **reverse order**. Each child gets `Process.exit(child_pid, :shutdown)` and then the `:shutdown` interval to finish (default 5000 ms). After this interval, the supervisor kills it with reason `:kill`.

<Diagram name="supervisor/shutdown" caption="Only a child that traps exits gets time to clean up." />

A child that does not trap exits ends at the first signal. If a process must clean up when the tree shuts down, it must **trap exits** so that `terminate` runs. Its child spec must also carry a suitable `:shutdown`.

## Exit reasons

Exits also affect logging: behaviours such as `GenServer` do not log `:normal`, `:shutdown`, or `{:shutdown, term}`.

| Exit reason | Logged | Restarted when `:transient` | Linked processes |
|---|---|---|---|
| `:normal` | no | no | do not exit |
| `:shutdown` or `{:shutdown, term}` | no | no | exit with the same reason, unless they trap exits |
| any other term | yes | yes | exit with the same reason, unless they trap exits |

For expected exits, use `:shutdown` or `{:shutdown, term}`.

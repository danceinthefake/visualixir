---
source: https://elixir.hexdocs.pm/Supervisor.html
---

# Supervisor

Source: [Elixir docs, Supervisor](https://elixir.hexdocs.pm/Supervisor.html).

A supervisor is a process that supervises other processes, its **children**. Supervisors build a hierarchy called a *supervision tree*, which gives you fault tolerance and decides how your application starts and shuts down.
You start one with a list of child specifications through `start_link/2`, or define a module-based supervisor that implements the callbacks.

```elixir
children = [
  # The Counter is a child started via Counter.start_link(0)
  %{id: Counter, start: {Counter, :start_link, [0]}}
]

{:ok, pid} = Supervisor.start_link(children, strategy: :one_for_one)

Supervisor.count_children(pid)
#=> %{active: 1, specs: 1, supervisors: 0, workers: 1}
```

If the registered `Counter` crashes (the docs bump it with a non-numeric value), the supervisor starts a new one, reset to its initial value `0`.

## Child specification

A child spec is a map. `:id` and `:start` are required, and the rest are optional:

| Key | Meaning | Default |
|---|---|---|
| `:id` | any term identifying the spec inside the supervisor. Conflicting ids stop a supervisor from initializing (a `DynamicSupervisor` allows them) | the module |
| `:start` | `{module, function, args}` that starts the child | required |
| `:restart` | when a terminated child is restarted | `:permanent` |
| `:shutdown` | how to terminate the child | `5_000` for a worker, `:infinity` for a supervisor |
| `:type` | `:worker` or `:supervisor` | `:worker` |
| `:modules` | modules used by hot code upgrade, set automatically from `:start` | rarely changed |
| `:significant` | counts for automatic shutdown. Only `:transient` and `:temporary` children can be significant | `false` |

### Restart values

<Diagram name="supervisor/restart" caption="The restart value decides what counts as a successful termination." />

`:permanent` is always restarted. `:temporary` is never restarted, whatever the strategy, and any termination, even abnormal, counts as successful. `:transient` is restarted only if it ends with a reason other than
`:normal`, `:shutdown` or `{:shutdown, term}`.

### Shutdown values

`:brutal_kill` terminates the child at once with `Process.exit(child, :kill)`. An integer `>= 0` is the milliseconds the supervisor waits after sending `Process.exit(child, :shutdown)`: a child not trapping exits
ends immediately, a child that traps exits has that long, then it is killed. `:infinity` waits forever and is recommended for a child that is itself a supervisor. For a regular worker it is discouraged and needs extreme care,
because the child may never terminate and then neither does your application.

## Strategies and options

`start_link/2` takes the children and these options:

| Option | Meaning | Default |
|---|---|---|
| `:strategy` | `:one_for_one`, `:rest_for_one` or `:one_for_all` | required |
| `:max_restarts` | most restarts allowed in the time frame | `3` |
| `:max_seconds` | the time frame for `:max_restarts` | `5` |
| `:auto_shutdown` | `:never`, `:any_significant` or `:all_significant` | `:never` |
| `:name` | name to register the supervisor, with the same rules as `GenServer` | none |

<Diagram name="supervisor/strategies" caption="Which children restart when B crashes." />

`:one_for_one` restarts only the terminated child. `:one_for_all` terminates all the others, then restarts all children, including the terminated one. `:rest_for_one` terminates and restarts the terminated child and
the children **started after it**. "Terminated" here means an unsuccessful termination as decided by `:restart`. For children started dynamically, see `DynamicSupervisor`.

<UnderTheHood>

**In short:** a supervisor restarts by starting a fresh process, so a restarted child has a new pid. Comparing pids shows exactly who was restarted.

**Strategies.** Three `GenServer` children `A`, `B` and `C` were started in that order, and `B` was made to crash. Comparing each child's pid before and after showed that only `B` had a new pid under `:one_for_one`, `B` and `C` under `:rest_for_one`, and all three under `:one_for_all`.

**Restart intensity.** With one child and the defaults (3 restarts in 5 seconds), crashing it repeatedly made the supervisor itself exit with reason `:shutdown` at about 155 ms, after the 4th crash. Its child was gone too.

**Shutdown.** Three children were started as `x`, `y` and a stubborn one that trapped exits and slept 10 seconds in `terminate/2`, with `shutdown: 300`. `Supervisor.stop/1` ended the children in the reverse order of the list (stubborn, `y`, `x`), and the whole stop took **301 ms**: the stubborn child had the full 300 ms and was then killed.

<Diagram name="supervisor/uth-strategies" caption="Compared pids after B crashed." />

*Sources:* `Process.whereis/1` pids compared before and after, and `terminate/2` calls recorded with `send/2`, on Elixir 1.20.4 with Erlang/OTP 29. The timings (155 ms, 301 ms) vary by machine.

</UnderTheHood>

### Restart intensity

If the supervisor exceeds `:max_restarts` within `:max_seconds`, it **gives up and exits with `:shutdown`**. Its own parent then decides what happens next: it is restarted only if its child spec says `:permanent` (the default).

<Diagram name="supervisor/intensity" caption="A supervisor that restarts too often fails upwards." />

### Automatic shutdown

A supervisor can shut itself down when `:significant` children exit. `:never` is the default. With `:any_significant` the supervisor shuts down its children, then itself, when any significant child exits. With `:all_significant` it does so
when all significant children have exited. A significant `:transient` child must exit normally to count. A `:temporary` one may exit for any reason.

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

The `init/1` callback must call `Supervisor.init/2`, which takes `:strategy`, `:max_restarts` and `:max_seconds`. `use Supervisor` sets `@behaviour Supervisor` and defines `child_spec/1`, so the module
can be a child of another supervisor (`:id` defaults to the module and `:restart` to `:permanent`). The guideline: use a supervisor **without** a callback module only at the top of your tree, usually in
`c:Application.start/2`, and use module-based ones elsewhere.

## Start and shutdown

The supervisor starts children **in the order listed**, by calling each child's `:start` function, typically `start_link/1`, which must return `{:ok, pid}` for a new process linked to the supervisor. Shutdown happens in **reverse order**.
Each child gets `Process.exit(child_pid, :shutdown)` and then the `:shutdown` interval to finish (default 5000 ms), after which it is killed with reason `:kill`.

<Diagram name="supervisor/shutdown" caption="Only a child that traps exits gets time to clean up." />

A child that isn't trapping exits ends at the first signal. If a process must clean up when the tree shuts down, it must **trap exits** (so `terminate` runs) and its child spec should carry a suitable `:shutdown`.

## Exit reasons

Exits also affect logging: behaviours such as `GenServer` don't log `:normal`, `:shutdown` or `{:shutdown, term}`.

| Exit reason | Logged | Restarted when `:transient` | Linked processes |
|---|---|---|---|
| `:normal` | no | no | do not exit |
| `:shutdown` or `{:shutdown, term}` | no | no | exit with the same reason, unless trapping exits |
| any other term | yes | yes | exit with the same reason, unless trapping exits |

For expected exits, prefer `:shutdown` or `{:shutdown, term}`.

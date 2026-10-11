# Supervising dynamic children

Source: [Elixir guide, Supervising dynamic children](https://elixir.hexdocs.pm/dynamic-supervisor.html).

Buckets have names. Now the system must supervise them and must be able to create them at any time.

## Child specs

A supervisor learns how to start a child from its **child specification**. A module or `{module, options}` in the list of children is short for a call to the `child_spec/1` function of that module:

```elixir
Registry.child_spec(name: KV, keys: :unique)
#=> %{id: KV,
#     start: {Registry, :start_link, [[name: KV, keys: :unique]]},
#     type: :supervisor}
```

`:id` and `:start` (a triplet of module, function, and arguments) are required. `type` and the other keys are optional.

<Diagram name="dynamic-supervisor/child-spec" caption="A tuple is short for a map. The supervisor uses the map." />

`use Agent` (and `use GenServer` and `use Supervisor`) define a default `child_spec/1`. For this reason a supervisor can already supervise `KV.Bucket`:

```elixir
KV.Bucket.child_spec(name: :shopping)
#=> %{id: KV.Bucket, start: {KV.Bucket, :start_link, [[name: :shopping]]}}

Supervisor.start_link([{KV.Bucket, name: :shopping}], strategy: :one_for_one)
pid = Process.whereis(:shopping)
Process.exit(pid, :kill)
Process.whereis(:shopping)    #=> #PID<0.50.0>   (a new pid)
```

<Diagram steps name="dynamic-supervisor/restart" caption="When you kill the bucket, the supervisor starts a new bucket with the same name." />

## Dynamic supervisors

If you list buckets in `start/2`, the application starts a **fixed** set of buckets. Users must be able to create buckets at any time. `Supervisor` can add children later, but it is not built for millions of children. `DynamicSupervisor` is built for them: it starts children *after* the supervisor starts.

```elixir
{:ok, sup} = DynamicSupervisor.start_link(strategy: :one_for_one)
DynamicSupervisor.start_child(sup, {KV.Bucket, name: :another_list})
```

Give the dynamic supervisor a name too, and use it with the registry. Then put both in the tree and add two functions to `KV`:

```elixir
def start(_type, _args) do
  children = [
    {Registry, name: KV, keys: :unique},
    {DynamicSupervisor, name: KV.BucketSupervisor, strategy: :one_for_one}
  ]

  Supervisor.start_link(children, strategy: :one_for_one)
end

def create_bucket(name) do
  DynamicSupervisor.start_child(KV.BucketSupervisor, {KV.Bucket, name: via(name)})
end

def lookup_bucket(name), do: GenServer.whereis(via(name))

defp via(name), do: {:via, Registry, {KV, name}}
```

<Diagram name="dynamic-supervisor/tree" caption="The dynamic supervisor is a fixed child. Its own children start and stop." />

A second `create_bucket/1` with the same name returns `{:error, {:already_started, pid}}`. Tests use a unique name to prevent clashes.

<UnderTheHood>

**What it costs to start a child.** A process is not an OS thread. It is a heap of a few hundred words and a mailbox that the VM sets up in memory. In two measurements, it took about 2.5 to 4 microseconds to spawn each of 1,000,000 processes. This time includes the time to build the list of pids. Each idle process held about 2.6 KB. For this reason a `DynamicSupervisor` can start one child for each bucket or each connection. It is also cheap to restart a child: a killed supervised child ran again after 150 to 200 microseconds. We did not measure where that time goes.

<Diagram name="dynamic-supervisor/uth-spawn" caption="To start or restart a process, the VM does a small amount of work." />

*Sources:* `:timer.tc/1` and `Process.info/2` on Erlang/OTP 29, 64-bit Linux. These are single measurements. The values will change from run to run.

</UnderTheHood>

## start_supervised

In tests, do not call `start_link/1`. ExUnit starts a supervision tree **for each test**. `start_supervised/2` puts processes in that tree, so ExUnit stops them when the test ends:

```elixir
{:ok, bucket} = start_supervised(KV.Bucket)
{:ok, _} = start_supervised({KV.Bucket, name: config.test})
```

## Observer

`:observer.start()` opens a GUI. Inside a project, first call `Mix.ensure_application!(:observer)`. The Applications tab draws the supervision tree of each running application. New buckets appear when you create them. To make sure that your supervisor reacts, right-click a process and send a kill signal. For this reason, put processes in supervision trees even if they are temporary. You can then reach them and look inside them.

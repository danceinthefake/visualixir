# Supervising dynamic children

Source: [Elixir guide, Supervising dynamic children](https://elixir.hexdocs.pm/dynamic-supervisor.html).

Buckets are named. Now they need to be supervised, and created at any time.

## Child specs

A supervisor learns how to start a child from its **child specification**. A module or `{module, options}` in the children list is shorthand for
calling that module's `child_spec/1`:

```elixir
Registry.child_spec(name: KV, keys: :unique)
#=> %{id: KV,
#     start: {Registry, :start_link, [[name: KV, keys: :unique]]},
#     type: :supervisor}
```

`:id` and `:start` (a module, function, args triplet) are required. `type` and others are optional.

<Diagram name="dynamic-supervisor/child-spec" caption="A tuple is shorthand. The map is what the supervisor uses." />

`use Agent` (and `use GenServer`, `use Supervisor`) define a default `child_spec/1`, so `KV.Bucket` is supervisable already:

```elixir
KV.Bucket.child_spec(name: :shopping)
#=> %{id: KV.Bucket, start: {KV.Bucket, :start_link, [[name: :shopping]]}}

Supervisor.start_link([{KV.Bucket, name: :shopping}], strategy: :one_for_one)
pid = Process.whereis(:shopping)
Process.exit(pid, :kill)
Process.whereis(:shopping)    #=> #PID<0.50.0>   (a new pid)
```

<Diagram name="dynamic-supervisor/restart" caption="Kill the bucket and the supervisor starts a new one under the same name." />

## Dynamic supervisors

Listing buckets in `start/2` starts a **fixed** set. Users must be able to create buckets at any time. `Supervisor` can add children later, but it
wasn't built for millions of them. `DynamicSupervisor` is: children are started *after* the supervisor.

```elixir
{:ok, sup} = DynamicSupervisor.start_link(strategy: :one_for_one)
DynamicSupervisor.start_child(sup, {KV.Bucket, name: :another_list})
```

Give it a name too, and combine it with the registry. Then put both in the tree and add two functions to `KV`:

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

<Diagram name="dynamic-supervisor/tree" caption="The dynamic supervisor is a fixed child. Its own children come and go." />

A second `create_bucket/1` with the same name returns `{:error, {:already_started, pid}}`. Tests use a unique name to avoid clashes.

<UnderTheHood>

**What it costs to start a child.** A process is not an OS thread. It is a heap of a few hundred words and a mailbox that the VM sets up in memory. Spawning 1,000,000 processes took about 4.2 microseconds each in a measurement here, and each idle one held about 2.6 KB. That is why a `DynamicSupervisor` can start a child per bucket, or per connection, and why restarting one is cheap: the 199 microseconds from the kill to a running child is mostly the exit signal and the supervisor's own work.

<Diagram name="dynamic-supervisor/uth-spawn" caption="Starting and restarting a process is a small amount of work for the VM." />

*Sources:* `:timer.tc/1` and `Process.info/2` on Erlang/OTP 29, 64-bit Linux. These are one-off measurements and will vary.

</UnderTheHood>

## start_supervised

Don't call `start_link/1` in tests. ExUnit starts a supervision tree **per test** and `start_supervised/2` puts processes in it, so they're shut down when
the test ends:

```elixir
{:ok, bucket} = start_supervised(KV.Bucket)
{:ok, _} = start_supervised({KV.Bucket, name: config.test})
```

## Observer

`:observer.start()` (after `Mix.ensure_application!(:observer)` inside a project) opens a GUI. Its Applications tab draws each running application's
supervision tree, and new buckets appear as you create them. Right-click a process to send a kill signal, a way to check that your
supervisor reacts. That is why processes belong in supervision trees even if temporary: they stay reachable and introspectable.

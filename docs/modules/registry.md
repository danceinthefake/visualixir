# Registry

Source: [Elixir docs, Registry](https://elixir.hexdocs.pm/Registry.html).

`Registry` is a **local, decentralized and scalable key-value store of processes**. A key points to one process (`:unique`) or to any number of processes (`:duplicate`). Different keys can point to the same process.

<Diagram name="registry/keys" caption="Unique keys point to at most one process. Duplicate keys can point to many." />

Each entry belongs to the process that registered the key. If that process crashes, its keys are removed automatically. Keys are compared with `===/2`.
A registry is used for name lookup (the `:via` option), storing properties, custom dispatch and a local pubsub. It can be partitioned for registries with thousands or millions of entries.

## Starting a registry

```elixir
{:ok, _} = Registry.start_link(keys: :unique, name: MyApp.Registry)
```

Usually it sits in a supervision tree: `{Registry, keys: :unique, name: MyApp.Registry}`.

| Option | Meaning |
|---|---|
| `:keys` | required: `:unique`, `:duplicate`, `{:duplicate, :key}` or `{:duplicate, :pid}` |
| `:name` | required: the name of the registry and its tables |
| `:partitions` | number of partitions, default `1`. A good value for intensive workloads is `System.schedulers_online()` |
| `:listeners` | named processes told about register and unregister events |
| `:meta` | a keyword list of metadata attached to the registry |

For `:duplicate` registries with many different keys and few subscribers each, `{:duplicate, :key}` partitioning lets a lookup check a single partition. The default `:pid` partitioning suits few keys with many entries each, such as
one topic with many subscribers.

## Naming processes with :via

Only registries with **unique keys** can be used in `:via`:

```elixir
{:ok, _} = Registry.start_link(keys: :unique, name: MyApp.Registry)
name = {:via, Registry, {MyApp.Registry, "agent"}}
{:ok, _} = Agent.start_link(fn -> 0 end, name: name)
Agent.get(name, & &1)       #=> 0
Agent.update(name, &(&1 + 1))
Agent.get(name, & &1)       #=> 1
```

<Diagram name="registry/via" caption="The name stands in for the pid. The registry resolves it." />

`Registry.lookup(MyApp.Registry, "agent")` returns `[{pid, nil}]`. A value can be stored with `{:via, Registry, {registry, key, value}}`. The lookup then returns `[{agent_pid, :hello}]`,
and you can still reach the process with the version of the tuple **without** the value. If the name is taken, the `start_link` function (`Agent.start_link/2` here) returns
`{:error, {:already_started, current_pid}}`.

## Registering by hand

`Registry.register/3` registers **the current process** under a key with a value. It returns `{:ok, owner}`, where the owner is the pid in the registry partition responsible for it, and the owner is linked to the caller.
On a unique registry a taken key returns `{:error, {:already_registered, pid}}`. A duplicate registry allows the same process to register under the same key several times, so `Registry.keys/2` can return `["hello", "hello"]`.

<UnderTheHood>

**In short:** a registry is a few ETS tables owned by a process. Lookups read the tables directly from your own process, and no message is sent.

**What `Registry.start_link` creates.** Listing the ETS tables before and after starting a unique registry with one partition showed **three** new tables, matching the docs (one table plus two per partition). One is named after the registry and holds its layout. The other two belong to a partition process: a `set` table that maps each key to `{pid, value}`, and a `duplicate_bag` table that maps each pid to its keys. The second table is keyed by pid. With 4 partitions on a duplicate registry the count was **9**: one plus two for each of the four.

**What a call does.** `Registry.register/3` linked the calling process to the partition process, and the two table rows were the ones above. Tracing the sends of the calling process during `Registry.lookup/2` showed **none**: the lookup reads the table from the caller. That is why the docs can call lookups efficient and immediate.

<Diagram name="registry/uth-tables" caption="One registry with one partition: three tables, owned by two processes." />

*Sources:* `:ets.all/0`, `:ets.info/2`, `:ets.tab2list/1` and `:erlang.trace/3` on Elixir 1.20.4 with Erlang/OTP 29. The docs also warn that removing the keys of a crashed process may not propagate immediately. A lookup right after killing a registered process, and 50 ms later, showed an empty list both times here, so this test did not show the delay.

</UnderTheHood>

## Dispatching

A duplicate registry can run custom logic over every entry under a key. `Registry.dispatch/3` takes the key and a callback, and the callback receives a list of `{pid, value}` tuples:

```elixir
{:ok, _} = Registry.start_link(keys: :duplicate, name: Registry.DispatcherTest)
{:ok, _} = Registry.register(Registry.DispatcherTest, "hello", {IO, :inspect})

Registry.dispatch(Registry.DispatcherTest, "hello", fn entries ->
  for {pid, {module, function}} <- entries, do: apply(module, function, [pid])
end)
# Prints #PID<...> where the PID is for the process that called register/3 above
#=> :ok
```

<Diagram name="registry/dispatch" caption="The callback runs in the caller. The registered processes only hear from it if the callback contacts them." />

Dispatching runs in the process that calls `dispatch/3`, serially, or concurrently across partitions with spawned tasks. If dispatching fails because of a bad registration, it always fails and the registered process is not notified,
so wrap the callback in `try`/`catch` and log the error.

## PubSub

A local, non-distributed pubsub is `dispatch/3` plus `send/2`. Use one partition per scheduler for concurrent workloads:

```elixir
{:ok, _} =
  Registry.start_link(
    keys: :duplicate,
    name: Registry.PubSubTest,
    partitions: System.schedulers_online()
  )

{:ok, _} = Registry.register(Registry.PubSubTest, "hello", [])

Registry.dispatch(Registry.PubSubTest, "hello", fn entries ->
  for {pid, _} <- entries, do: send(pid, {:broadcast, "world"})
end)
#=> :ok
```

Every process registered under the "topic" `"hello"` receives `{:broadcast, "world"}`. The value given to `register/3` is `[]` here because the example doesn't use it.

## Registrations and dead processes

Lookup, dispatch and registration are efficient and immediate, at the cost of **delayed unsubscription**. If a process crashes, its keys are removed automatically, but the change may not propagate at once, so some operations
can return a process that is already dead. The function docs say where this can happen. It is rarely a problem: a pid can die at any moment, even between the lookup and the `send`.
`Process.monitor/1` delivers `:DOWN` right away for a dead process and `send/2` does nothing for one.

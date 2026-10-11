---
source: https://elixir.hexdocs.pm/Registry.html
---

# Registry

Source: [Elixir docs, Registry](https://elixir.hexdocs.pm/Registry.html).

`Registry` is a **local, decentralized, and scalable key-value store of processes**. A key points to one process (`:unique`) or to any number of processes (`:duplicate`). Different keys can point to the same process.

<Diagram name="registry/keys" caption="Unique keys point to at most one process. Duplicate keys can point to many processes." />

Each entry belongs to the process that registered the key. If that process crashes, the system removes its keys automatically. Keys are compared with `===/2`. A registry is for name lookup (the `:via` option), storage of properties, custom dispatch, and a local pubsub. You can partition it for registries with thousands or millions of entries.

## Starting a registry

```elixir
{:ok, _} = Registry.start_link(keys: :unique, name: MyApp.Registry)
```

Usually the registry is in a supervision tree: `{Registry, keys: :unique, name: MyApp.Registry}`.

| Option | Meaning |
|---|---|
| `:keys` | required: `:unique`, `:duplicate`, `{:duplicate, :key}`, or `{:duplicate, :pid}` |
| `:name` | required: the name of the registry and its tables |
| `:partitions` | the number of partitions, default `1`. A good value for intensive workloads is `System.schedulers_online()` |
| `:listeners` | named processes that get events when a process registers or unregisters |
| `:meta` | a keyword list of metadata that is attached to the registry |

For `:duplicate` registries with many different keys and few subscribers for each key, the `{:duplicate, :key}` partitioning lets a lookup check a single partition. The default `:pid` partitioning is good for few keys with many entries for each key, such as one topic with many subscribers.

## Naming processes with :via

You can use only registries with **unique keys** in `:via`:

```elixir
{:ok, _} = Registry.start_link(keys: :unique, name: MyApp.Registry)
name = {:via, Registry, {MyApp.Registry, "agent"}}
{:ok, _} = Agent.start_link(fn -> 0 end, name: name)
Agent.get(name, & &1)       #=> 0
Agent.update(name, &(&1 + 1))
Agent.get(name, & &1)       #=> 1
```

<Diagram name="registry/via" caption="The name replaces the pid. The registry resolves it." />

`Registry.lookup(MyApp.Registry, "agent")` returns `[{pid, nil}]`. You can store a value with `{:via, Registry, {registry, key, value}}`. The lookup then returns `[{agent_pid, :hello}]`, and you can still reach the process with the version of the tuple **without** the value. If the name is taken, the `start_link` function (`Agent.start_link/2` here) returns `{:error, {:already_started, current_pid}}`.

## Register by hand

`Registry.register/3` registers **the current process** under a key with a value. It returns `{:ok, owner}`. The owner is the pid in the registry partition that is responsible for it, and the owner is linked to the caller. On a unique registry, a key that is taken returns `{:error, {:already_registered, pid}}`. A duplicate registry allows the same process to register under the same key several times, so `Registry.keys/2` can return `["hello", "hello"]`.

<UnderTheHood>

**In short:** a registry is a few ETS tables that one process owns. Lookups read the tables directly from your own process, and no message is sent.

**What `Registry.start_link` creates.** We listed the ETS tables before and after we started a unique registry with one partition. We saw **three** new tables, which matches the docs (one table plus two for each partition). One is named after the registry and holds its layout. The other two belong to a partition process. One is a `set` table that maps each key to `{pid, value}`. The other is a `duplicate_bag` table that maps each pid to its keys. The key of the second table is the pid. With 4 partitions on a duplicate registry, the count was **9**: one plus two for each of the four.

**What a call does.** `Registry.register/3` linked the calling process to the partition process, and the two table rows were the rows above. We traced the sends of the calling process during `Registry.lookup/2` and saw **none**: the lookup reads the table from the caller. For this reason, the docs can call lookups efficient and immediate.

<Diagram name="registry/uth-tables" caption="One registry with one partition: three tables, owned by two processes." />

*Sources:* `:ets.all/0`, `:ets.info/2`, `:ets.tab2list/1`, and `:erlang.trace/3` on Elixir 1.20.4 with Erlang/OTP 29. The docs also warn that the removal of the keys of a crashed process cannot propagate immediately. We did a lookup right after we killed a registered process, and again 50 ms later. Both showed an empty list, so this test did not show the delay.

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

<Diagram steps name="registry/dispatch" caption="The callback runs in the caller. The registered processes hear from it only if the callback contacts them." />

Dispatching runs in the process that calls `dispatch/3`. It runs serially, or concurrently across partitions with spawned tasks. If dispatching fails because of a bad registration, it always fails, and the registered process gets no notification. For this reason, wrap the callback in `try`/`catch` and log the error.

## PubSub

A local pubsub that is not distributed is `dispatch/3` plus `send/2`. Use one partition for each scheduler for concurrent workloads:

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

Every process that is registered under the "topic" `"hello"` receives `{:broadcast, "world"}`. The value that we give to `register/3` is `[]` here, because the example does not use it.

## Registrations and dead processes

Lookup, dispatch, and registration are efficient and immediate. The cost is **delayed unsubscription**. If a process crashes, the system removes its keys automatically, but the change cannot propagate at once, so some operations can return a process that is already dead. The function docs say where this can happen. It is rarely a problem, because a pid can die at any time, even between the lookup and the `send`. `Process.monitor/1` delivers `:DOWN` immediately for a dead process, and `send/2` does nothing for one.

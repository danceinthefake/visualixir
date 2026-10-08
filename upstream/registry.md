<!-- source: https://elixir.hexdocs.pm/Registry.md -->
# `Registry`
[🔗](https://github.com/elixir-lang/elixir/blob/v1.20.4/lib/elixir/lib/registry.ex#L5)

A local, decentralized and scalable key-value process storage.

It allows developers to lookup one or more processes with a given key.
If the registry has `:unique` keys, a key points to 0 or 1 process.
If the registry allows `:duplicate` keys, a single key may point to any
number of processes. In both cases, different keys could identify the
same process.

Each entry in the registry is associated to the process that has
registered the key. If the process crashes, the keys associated to that
process are automatically removed. All key comparisons in the registry
are done using the match operation (`===/2`).

The registry can be used for different purposes, such as name lookups (using
the `:via` option), storing properties, custom dispatching rules, or a pubsub
implementation. We explore some of those use cases below.

The registry may also be transparently partitioned, which provides
more scalable behavior for running registries on highly concurrent
environments with thousands or millions of entries.

## Using in `:via`

Once the registry is started with a given name using
`Registry.start_link/1`, it can be used to register and access named
processes using the `{:via, Registry, {registry, key}}` tuple:

    {:ok, _} = Registry.start_link(keys: :unique, name: MyApp.Registry)
    name = {:via, Registry, {MyApp.Registry, "agent"}}
    {:ok, _} = Agent.start_link(fn -> 0 end, name: name)
    Agent.get(name, & &1)
    #=> 0
    Agent.update(name, &(&1 + 1))
    Agent.get(name, & &1)
    #=> 1

In the previous example, we were not interested in associating a value to the
process:

    Registry.lookup(MyApp.Registry, "agent")
    #=> [{self(), nil}]

However, in some cases it may be desired to associate a value to the process
using the alternate `{:via, Registry, {registry, key, value}}` tuple:

    {:ok, _} = Registry.start_link(keys: :unique, name: MyApp.Registry)
    name = {:via, Registry, {MyApp.Registry, "agent", :hello}}
    {:ok, agent_pid} = Agent.start_link(fn -> 0 end, name: name)

    Registry.lookup(MyApp.Registry, "agent")
    #=> [{agent_pid, :hello}]

    name_without_meta = {:via, Registry, {MyApp.Registry, "agent"}}
    Agent.update(name_without_meta, fn x -> x + 1 end)
    Agent.get(name_without_meta, & &1)
    #=> 1

> #### With *and* without metadata {: .tip}
>
> When using the version of `:via` tuples with *metadata*, you can still use the version
> **without** metadata to look up the process.

To this point, we have been starting `Registry` using `start_link/1`.
Typically the registry is started as part of a supervision tree though:

    {Registry, keys: :unique, name: MyApp.Registry}

Only registries with unique keys can be used in `:via`. If the name is
already taken, the case-specific `start_link` function (`Agent.start_link/2`
in the example above) will return `{:error, {:already_started, current_pid}}`.

## Using as a dispatcher

`Registry` has a dispatch mechanism that allows developers to implement custom
dispatch logic triggered from the caller. For example, let's say we have a
duplicate registry started as so:

    {:ok, _} = Registry.start_link(keys: :duplicate, name: Registry.DispatcherTest)

By calling `register/3`, different processes can register under a given key
and associate any value under that key. In this case, let's register the
current process under the key `"hello"` and attach the `{IO, :inspect}` tuple
to it:

    {:ok, _} = Registry.register(Registry.DispatcherTest, "hello", {IO, :inspect})

Now, an entity interested in dispatching events for a given key may call
`dispatch/3` passing in the key and a callback. This callback will be invoked
with a list of all the values registered under the requested key, alongside
the PID of the process that registered each value, in the form of `{pid,
value}` tuples. In our example, `value` will be the `{module, function}` tuple
in the code above:

    Registry.dispatch(Registry.DispatcherTest, "hello", fn entries ->
      for {pid, {module, function}} <- entries, do: apply(module, function, [pid])
    end)
    # Prints #PID<...> where the PID is for the process that called register/3 above
    #=> :ok

Dispatching happens in the process that calls `dispatch/3` either serially or
concurrently in case of multiple partitions (via spawned tasks). The
registered processes are not involved in dispatching unless involving them is
done explicitly (for example, by sending them a message in the callback).

Furthermore, if there is a failure when dispatching, due to a bad
registration, dispatching will always fail and the registered process will not
be notified. Therefore let's make sure we at least wrap and report those
errors:

    require Logger

    Registry.dispatch(Registry.DispatcherTest, "hello", fn entries ->
      for {pid, {module, function}} <- entries do
        try do
          apply(module, function, [pid])
        catch
          kind, reason ->
            formatted = Exception.format(kind, reason, __STACKTRACE__)
            Logger.error("Registry.dispatch/3 failed with #{formatted}")
        end
      end
    end)
    # Prints #PID<...>
    #=> :ok

You could also replace the whole `apply` system by explicitly sending
messages. That's the example we will see next.

## Using as a PubSub

Registries can also be used to implement a local, non-distributed, scalable
PubSub by relying on the `dispatch/3` function, similarly to the previous
section: in this case, however, we will send messages to each associated
process, instead of invoking a given module-function.

In this example, we will also set the number of partitions to the number of
schedulers online, which will make the registry more performant on highly
concurrent environments:

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

The example above broadcasted the message `{:broadcast, "world"}` to all
processes registered under the "topic" (or "key" as we called it until now)
`"hello"`.

The third argument given to `register/3` is a value associated to the
current process. While in the previous section we used it when dispatching,
in this particular example we are not interested in it, so we have set it
to an empty list. You could store a more meaningful value if necessary.

## Registrations

Looking up, dispatching and registering are efficient and immediate at
the cost of delayed unsubscription. For example, if a process crashes,
its keys are automatically removed from the registry but the change may
not propagate immediately. This means certain operations may return processes
that are already dead. When such may happen, it will be explicitly stated
in the function documentation.

However, keep in mind those cases are typically not an issue. After all, a
process referenced by a PID may crash at any time, including between getting
the value from the registry and sending it a message. Many parts of the standard
library are designed to cope with that, such as `Process.monitor/1` which will
deliver the `:DOWN` message immediately if the monitored process is already dead
and `send/2` which acts as a no-op for dead processes.

## ETS

Note that the registry uses one ETS table plus two ETS tables per partition.

# `body`

```elixir
@type body() :: [term()]
```

A pattern used to representing the output format part of a match spec

# `dispatch_opts`

```elixir
@type dispatch_opts() :: [{:parallel, boolean()}]
```

Options used for `dispatch/4`.

# `guard`

```elixir
@type guard() :: atom() | tuple()
```

A guard to be evaluated when matching on objects in a registry

# `guards`

```elixir
@type guards() :: [guard()]
```

A list of guards to be evaluated when matching on objects in a registry

# `key`

```elixir
@type key() :: term()
```

The type of keys allowed on registration

# `keys`

```elixir
@type keys() :: :unique | :duplicate | {:duplicate, :key} | {:duplicate, :pid}
```

The type of the registry

# `listener_message`
*since 1.15.0* 

```elixir
@type listener_message() ::
  {:register, registry(), key(), registry_partition :: pid(), value()}
  | {:unregister, registry(), key(), registry_partition :: pid()}
```

The message that the registry sends to listeners when a process registers or unregisters.

See the `:listeners` option in `start_link/1`.

# `match_pattern`

```elixir
@type match_pattern() :: atom() | term()
```

A pattern to match on objects in a registry

# `meta_key`

```elixir
@type meta_key() :: atom() | tuple()
```

The type of registry metadata keys

# `meta_value`

```elixir
@type meta_value() :: term()
```

The type of registry metadata values

# `registry`

```elixir
@type registry() :: atom()
```

The registry identifier

# `spec`

```elixir
@type spec() :: [{match_pattern(), guards(), body()}]
```

A full match spec used when selecting objects in the registry

# `start_option`

```elixir
@type start_option() ::
  {:keys, keys()}
  | {:name, registry()}
  | {:partitions, pos_integer()}
  | {:listeners, [atom()]}
  | {:meta, [{meta_key(), meta_value()}]}
```

Options used for `child_spec/1` and `start_link/1`

# `value`

```elixir
@type value() :: term()
```

The type of values allowed on registration

# `child_spec`
*since 1.5.0* 

```elixir
@spec child_spec([start_option()]) :: Supervisor.child_spec()
```

Returns a specification to start a registry under a supervisor.

See `Supervisor`.

# `count`
*since 1.7.0* 

```elixir
@spec count(registry()) :: non_neg_integer()
```

Returns the number of registered keys in a registry.
It runs in constant time.

## Examples
In the example below we register the current process and ask for the
number of keys in the registry:

    iex> Registry.start_link(keys: :unique, name: Registry.UniqueCountTest)
    iex> Registry.count(Registry.UniqueCountTest)
    0
    iex> {:ok, _} = Registry.register(Registry.UniqueCountTest, "hello", :world)
    iex> {:ok, _} = Registry.register(Registry.UniqueCountTest, "world", :world)
    iex> Registry.count(Registry.UniqueCountTest)
    2

The same applies to duplicate registries:

    iex> Registry.start_link(keys: :duplicate, name: Registry.DuplicateCountTest)
    iex> Registry.count(Registry.DuplicateCountTest)
    0
    iex> {:ok, _} = Registry.register(Registry.DuplicateCountTest, "hello", :world)
    iex> {:ok, _} = Registry.register(Registry.DuplicateCountTest, "hello", :world)
    iex> Registry.count(Registry.DuplicateCountTest)
    2

# `count_match`
*since 1.7.0* 

```elixir
@spec count_match(registry(), key(), match_pattern(), guards()) :: non_neg_integer()
```

Returns the number of `{pid, value}` pairs under the given `key` in `registry`
that match `pattern`.

Pattern must be an atom or a tuple that will match the structure of the
value stored in the registry. The atom `:_` can be used to ignore a given
value or tuple element, while the atom `:"$1"` can be used to temporarily assign part
of pattern to a variable for a subsequent comparison.

Optionally, it is possible to pass a list of guard conditions for more precise matching.
Each guard is a tuple, which describes checks that should be passed by assigned part of pattern.
For example the `$1 > 1` guard condition would be expressed as the `{:>, :"$1", 1}` tuple.
Please note that guard conditions will work only for assigned
variables like `:"$1"`, `:"$2"`, and so forth.
Avoid usage of special match variables `:"$_"` and `:"$$"`, because it might not work as expected.

Zero will be returned if there is no match.

For unique registries, a single partition lookup is necessary. For
duplicate registries, all partitions must be looked up.

## Examples

In the example below we register the current process under the same
key in a duplicate registry but with different values:

    iex> Registry.start_link(keys: :duplicate, name: Registry.CountMatchTest)
    iex> {:ok, _} = Registry.register(Registry.CountMatchTest, "hello", {1, :atom, 1})
    iex> {:ok, _} = Registry.register(Registry.CountMatchTest, "hello", {2, :atom, 2})
    iex> Registry.count_match(Registry.CountMatchTest, "hello", {1, :_, :_})
    1
    iex> Registry.count_match(Registry.CountMatchTest, "hello", {2, :_, :_})
    1
    iex> Registry.count_match(Registry.CountMatchTest, "hello", {:_, :atom, :_})
    2
    iex> Registry.count_match(Registry.CountMatchTest, "hello", {:"$1", :_, :"$1"})
    2
    iex> Registry.count_match(Registry.CountMatchTest, "hello", {:_, :_, :"$1"}, [{:>, :"$1", 1}])
    1
    iex> Registry.count_match(Registry.CountMatchTest, "hello", {:_, :"$1", :_}, [{:is_atom, :"$1"}])
    2

# `count_select`
*since 1.14.0* 

```elixir
@spec count_select(registry(), spec()) :: non_neg_integer()
```

Works like `select/2`, but only returns the number of matching records.

## Examples

In the example below we register the current process under different
keys in a unique registry but with the same value:

    iex> Registry.start_link(keys: :unique, name: Registry.CountSelectTest)
    iex> {:ok, _} = Registry.register(Registry.CountSelectTest, "hello", :value)
    iex> {:ok, _} = Registry.register(Registry.CountSelectTest, "world", :value)
    iex> Registry.count_select(Registry.CountSelectTest, [{{:_, :_, :value}, [], [true]}])
    2

# `delete_meta`
*since 1.11.0* 

```elixir
@spec delete_meta(registry(), meta_key()) :: :ok
```

Deletes registry metadata for the given `key` in `registry`.

## Examples

    iex> Registry.start_link(keys: :unique, name: Registry.DeleteMetaTest)
    iex> Registry.put_meta(Registry.DeleteMetaTest, :custom_key, "custom_value")
    :ok
    iex> Registry.meta(Registry.DeleteMetaTest, :custom_key)
    {:ok, "custom_value"}
    iex> Registry.delete_meta(Registry.DeleteMetaTest, :custom_key)
    :ok
    iex> Registry.meta(Registry.DeleteMetaTest, :custom_key)
    :error

# `dispatch`
*since 1.4.0* 

```elixir
@spec dispatch(registry(), key(), dispatcher, dispatch_opts()) :: :ok
when dispatcher:
       (entries :: [{pid(), value()}] -&gt; term()) | {module(), atom(), [term()]}
```

Invokes the callback with all entries under `key` in each partition
for the given `registry`.

The list of `entries` is a non-empty list of two-element tuples where
the first element is the PID and the second element is the value
associated to the PID. If there are no entries for the given key,
the callback is never invoked.

If the registry is partitioned, the callback is invoked multiple times
per partition. If the registry is partitioned and `parallel: true` is
given as an option, the dispatching happens in parallel. In both cases,
the callback is only invoked if there are entries for that partition.

For `{:duplicate, :key}` registries, all entries for a given key are in a
single partition, so the `:parallel` option has no effect.

See the module documentation for examples of using the `dispatch/3`
function for building custom dispatching or a pubsub system.

## Options

  * `:parallel` - if `true`, the dispatching is done in parallel
    across all partitions. Only meaningful for `{:duplicate, :pid}`
    registries. Defaults to `false`.

# `keys`
*since 1.4.0* 

```elixir
@spec keys(registry(), pid()) :: [key()]
```

Returns the known keys for the given `pid` in `registry` in no particular order.

If the registry is unique, the keys are unique. Otherwise
they may contain duplicates if the process was registered
under the same key multiple times. The list will be empty
if the process is dead or it has no keys in this registry.

## Examples

Registering under a unique registry does not allow multiple entries:

    iex> Registry.start_link(keys: :unique, name: Registry.UniqueKeysTest)
    iex> Registry.keys(Registry.UniqueKeysTest, self())
    []
    iex> {:ok, _} = Registry.register(Registry.UniqueKeysTest, "hello", :world)
    iex> Registry.register(Registry.UniqueKeysTest, "hello", :later) # registry is :unique
    {:error, {:already_registered, self()}}
    iex> Registry.keys(Registry.UniqueKeysTest, self())
    ["hello"]

Such is possible for duplicate registries though:

    iex> Registry.start_link(keys: :duplicate, name: Registry.DuplicateKeysTest)
    iex> Registry.keys(Registry.DuplicateKeysTest, self())
    []
    iex> {:ok, _} = Registry.register(Registry.DuplicateKeysTest, "hello", :world)
    iex> {:ok, _} = Registry.register(Registry.DuplicateKeysTest, "hello", :world)
    iex> Registry.keys(Registry.DuplicateKeysTest, self())
    ["hello", "hello"]

# `lock`
*since 1.18.0* 

Out-of-band locking of the given `lock_key` for the duration of `function`.

Only one function can execute under the same `lock_key` at a given
time. The given function always runs in the caller process.

The `lock_key` has its own namespace and therefore does not clash or
overlap with the regular registry keys. In other words, locking works
out-of-band from the regular Registry operations. See the "Use cases"
section below.

Locking behaves the same regardless of the registry type.

## Use cases

The Registry is safe and concurrent out-of-the-box. You are not required
to use this function when interacting with the Registry. Furthermore,
`Registry` with `:unique` keys can already act as a process-lock for any
given key. For example, you can ensure only one process runs at a given
time for a given `:key` by doing:

    name = {:via, Registry, {MyApp.Registry, :key, :value}}

    # Do not attempt to start if we are already running
    if pid = GenServer.whereis(name) do
      pid
    else
      case GenServer.start_link(__MODULE__, :ok, name: name) do
        {:ok, pid} -> pid
        {:error, {:already_started, pid}} -> pid
      end
    end

Process locking gives you plenty of flexibility and fault isolation and
is enough for most cases.

This function is useful only when spawning processes is not an option,
for example, when copying the data to another process could be too
expensive. Or when the work must be done within the current process
for other reasons. In such cases, this function provides a scalable
mechanism for managing locks on top of the registry's infrastructure.

## Examples

    iex> Registry.start_link(keys: :unique, name: Registry.LockTest)
    iex> Registry.lock(Registry.LockTest, :hello, fn -> :ok end)
    :ok
    iex> Registry.lock(Registry.LockTest, :world, fn -> self() end)
    self()

# `lookup`
*since 1.4.0* 

```elixir
@spec lookup(registry(), key()) :: [{pid(), value()}]
```

Finds the `{pid, value}` pair for the given `key` in `registry` in no particular order.

An empty list if there is no match.

For unique registries, a single partition lookup is necessary. For
duplicate registries, all partitions must be looked up.

## Examples

In the example below we register the current process and look it up
both from itself and other processes:

    iex> Registry.start_link(keys: :unique, name: Registry.UniqueLookupTest)
    iex> Registry.lookup(Registry.UniqueLookupTest, "hello")
    []
    iex> {:ok, _} = Registry.register(Registry.UniqueLookupTest, "hello", :world)
    iex> Registry.lookup(Registry.UniqueLookupTest, "hello")
    [{self(), :world}]
    iex> Task.async(fn -> Registry.lookup(Registry.UniqueLookupTest, "hello") end) |> Task.await()
    [{self(), :world}]

The same applies to duplicate registries:

    iex> Registry.start_link(keys: :duplicate, name: Registry.DuplicateLookupTest)
    iex> Registry.lookup(Registry.DuplicateLookupTest, "hello")
    []
    iex> {:ok, _} = Registry.register(Registry.DuplicateLookupTest, "hello", :world)
    iex> Registry.lookup(Registry.DuplicateLookupTest, "hello")
    [{self(), :world}]
    iex> {:ok, _} = Registry.register(Registry.DuplicateLookupTest, "hello", :another)
    iex> Enum.sort(Registry.lookup(Registry.DuplicateLookupTest, "hello"))
    [{self(), :another}, {self(), :world}]

# `match`
*since 1.4.0* 

```elixir
@spec match(registry(), key(), match_pattern(), guards()) :: [{pid(), term()}]
```

Returns `{pid, value}` pairs under the given `key` in `registry` that match `pattern`.

Pattern must be an atom or a tuple that will match the structure of the
value stored in the registry. The atom `:_` can be used to ignore a given
value or tuple element, while the atom `:"$1"` can be used to temporarily assign part
of pattern to a variable for a subsequent comparison.

Optionally, it is possible to pass a list of guard conditions for more precise matching.
Each guard is a tuple, which describes checks that should be passed by assigned part of pattern.
For example the `$1 > 1` guard condition would be expressed as the `{:>, :"$1", 1}` tuple.
Please note that guard conditions will work only for assigned
variables like `:"$1"`, `:"$2"`, and so forth.
Avoid usage of special match variables `:"$_"` and `:"$$"`, because it might not work as expected.

An empty list will be returned if there is no match.

For unique registries, a single partition lookup is necessary. For
duplicate registries, all partitions must be looked up.

## Examples

In the example below we register the current process under the same
key in a duplicate registry but with different values:

    iex> Registry.start_link(keys: :duplicate, name: Registry.MatchTest)
    iex> {:ok, _} = Registry.register(Registry.MatchTest, "hello", {1, :atom, 1})
    iex> {:ok, _} = Registry.register(Registry.MatchTest, "hello", {2, :atom, 2})
    iex> Registry.match(Registry.MatchTest, "hello", {1, :_, :_})
    [{self(), {1, :atom, 1}}]
    iex> Registry.match(Registry.MatchTest, "hello", {2, :_, :_})
    [{self(), {2, :atom, 2}}]
    iex> Registry.match(Registry.MatchTest, "hello", {:_, :atom, :_}) |> Enum.sort()
    [{self(), {1, :atom, 1}}, {self(), {2, :atom, 2}}]
    iex> Registry.match(Registry.MatchTest, "hello", {:"$1", :_, :"$1"}) |> Enum.sort()
    [{self(), {1, :atom, 1}}, {self(), {2, :atom, 2}}]
    iex> guards = [{:>, :"$1", 1}]
    iex> Registry.match(Registry.MatchTest, "hello", {:_, :_, :"$1"}, guards)
    [{self(), {2, :atom, 2}}]
    iex> guards = [{:is_atom, :"$1"}]
    iex> Registry.match(Registry.MatchTest, "hello", {:_, :"$1", :_}, guards) |> Enum.sort()
    [{self(), {1, :atom, 1}}, {self(), {2, :atom, 2}}]

# `meta`
*since 1.4.0* 

```elixir
@spec meta(registry(), meta_key()) :: {:ok, meta_value()} | :error
```

Reads registry metadata given on `start_link/1`.

Atoms and tuples are allowed as keys.

## Examples

    iex> Registry.start_link(keys: :unique, name: Registry.MetaTest, meta: [custom_key: "custom_value"])
    iex> Registry.meta(Registry.MetaTest, :custom_key)
    {:ok, "custom_value"}
    iex> Registry.meta(Registry.MetaTest, :unknown_key)
    :error

# `put_meta`
*since 1.4.0* 

```elixir
@spec put_meta(registry(), meta_key(), meta_value()) :: :ok
```

Stores registry metadata.

Atoms and tuples are allowed as keys.

## Examples

    iex> Registry.start_link(keys: :unique, name: Registry.PutMetaTest)
    iex> Registry.put_meta(Registry.PutMetaTest, :custom_key, "custom_value")
    :ok
    iex> Registry.meta(Registry.PutMetaTest, :custom_key)
    {:ok, "custom_value"}
    iex> Registry.put_meta(Registry.PutMetaTest, {:tuple, :key}, "tuple_value")
    :ok
    iex> Registry.meta(Registry.PutMetaTest, {:tuple, :key})
    {:ok, "tuple_value"}

# `register`
*since 1.4.0* 

```elixir
@spec register(registry(), key(), value()) ::
  {:ok, pid()} | {:error, {:already_registered, pid()}}
```

Registers the current process under the given `key` in `registry`.

A value to be associated with this registration must also be given.
This value will be retrieved whenever dispatching or doing a key
lookup.

This function returns `{:ok, owner}` or `{:error, reason}`.
The `owner` is the PID in the registry partition responsible for
the PID. The owner is automatically linked to the caller.

If the registry has unique keys, it will return `{:ok, owner}` unless
the key is already associated to a PID, in which case it returns
`{:error, {:already_registered, pid}}`.

If the registry has duplicate keys, multiple registrations from the
current process under the same key are allowed.

If the registry has listeners specified via the `:listeners` option in `start_link/1`,
those listeners will be notified of the registration and will receive a
message of type `t:listener_message/0`.

## Examples

Registering under a unique registry does not allow multiple entries:

    iex> Registry.start_link(keys: :unique, name: Registry.UniqueRegisterTest)
    iex> {:ok, _} = Registry.register(Registry.UniqueRegisterTest, "hello", :world)
    iex> Registry.register(Registry.UniqueRegisterTest, "hello", :later)
    {:error, {:already_registered, self()}}
    iex> Registry.keys(Registry.UniqueRegisterTest, self())
    ["hello"]

Such is possible for duplicate registries though:

    iex> Registry.start_link(keys: :duplicate, name: Registry.DuplicateRegisterTest)
    iex> {:ok, _} = Registry.register(Registry.DuplicateRegisterTest, "hello", :world)
    iex> {:ok, _} = Registry.register(Registry.DuplicateRegisterTest, "hello", :world)
    iex> Registry.keys(Registry.DuplicateRegisterTest, self())
    ["hello", "hello"]

# `select`
*since 1.9.0* 

```elixir
@spec select(registry(), spec()) :: [term()]
```

Select key, pid, and values registered using full match specs.

The `spec` consists of a list of three part tuples, in the shape of `[{match_pattern, guards, body}]`.

The first part, the match pattern, must be a tuple that will match the structure of the
the data stored in the registry, which is `{key, pid, value}`. The atom `:_` can be used to
ignore a given value or tuple element, while the atom `:"$1"` can be used to temporarily
assign part of pattern to a variable for a subsequent comparison. This can be combined
like `{:"$1", :_, :_}`.

The second part, the guards, is a list of conditions that allow filtering the results.
Each guard is a tuple, which describes checks that should be passed by assigned part of pattern.
For example the `$1 > 1` guard condition would be expressed as the `{:>, :"$1", 1}` tuple.
Please note that guard conditions will work only for assigned
variables like `:"$1"`, `:"$2"`, and so forth.

The third part, the body, is a list of shapes of the returned entries. Like guards, you have access to
assigned variables like `:"$1"`, which you can combine with hard-coded values to freely shape entries
Note that tuples have to be wrapped in an additional tuple. To get a result format like
`%{key: key, pid: pid, value: value}`, assuming you bound those variables in order in the match part,
you would provide a body like `[%{key: :"$1", pid: :"$2", value: :"$3"}]`. Like guards, you can use
some operations like `:element` to modify the output format.

Do not use special match variables `:"$_"` and `:"$$"`, because they might not work as expected.
In particular, `{:duplicate, :key}` registries use a different internal ETS layout, so match specs
that reference the underlying entry structure via `:"$_"` will return different results.
Use named variables like `:"$1"`, `:"$2"`, `:"$3"` instead.

Note that for large registries with many partitions this will be costly as it builds the result by
concatenating all the partitions.

## Examples

This example shows how to get everything from the registry:

    iex> Registry.start_link(keys: :unique, name: Registry.SelectAllTest)
    iex> {:ok, _} = Registry.register(Registry.SelectAllTest, "hello", :value)
    iex> {:ok, _} = Registry.register(Registry.SelectAllTest, "world", :value)
    iex> Registry.select(Registry.SelectAllTest, [{{:"$1", :"$2", :"$3"}, [], [{{:"$1", :"$2", :"$3"}}]}]) |> Enum.sort()
    [{"hello", self(), :value}, {"world", self(), :value}]

If you want to get keys, you can pass a separate selector:

    iex> Registry.start_link(keys: :unique, name: Registry.SelectKeysTest)
    iex> {:ok, _} = Registry.register(Registry.SelectKeysTest, "hello", :value)
    iex> {:ok, _} = Registry.register(Registry.SelectKeysTest, "world", :value)
    iex> Registry.select(Registry.SelectKeysTest, [{{:"$1", :_, :_}, [], [:"$1"]}]) |> Enum.sort()
    ["hello", "world"]

# `start_link`
*since 1.5.0* 

```elixir
@spec start_link([start_option()]) :: {:ok, pid()} | {:error, term()}
```

Starts the registry as a supervisor process.

Manually it can be started as:

    Registry.start_link(keys: :unique, name: MyApp.Registry)

In your supervisor tree, you would write:

    Supervisor.start_link([
      {Registry, keys: :unique, name: MyApp.Registry}
    ], strategy: :one_for_one)

For intensive workloads, the registry may also be partitioned (by specifying
the `:partitions` option). If partitioning is required then a good default is to
set the number of partitions to the number of schedulers available:

    Registry.start_link(
      keys: :unique,
      name: MyApp.Registry,
      partitions: System.schedulers_online()
    )

or:

    Supervisor.start_link([
      {Registry, keys: :unique, name: MyApp.Registry, partitions: System.schedulers_online()}
    ], strategy: :one_for_one)

For `:duplicate` registries with many different keys (e.g., many topics with
few subscribers each), you can optimize key-based lookups by partitioning by key:

    Registry.start_link(
      keys: {:duplicate, :key},
      name: MyApp.TopicRegistry,
      partitions: System.schedulers_online()
    )

This allows key-based lookups to check only a single partition instead of
searching all partitions. Use the default `:pid` partitioning when you have
fewer keys with many entries each (e.g., one topic with many subscribers).

## Options

The registry requires the following keys:

  * `:keys` - chooses if keys are `:unique`, `:duplicate`,
    `{:duplicate, :key}`, or `{:duplicate, :pid}`
  * `:name` - the name of the registry and its tables

The following keys are optional:

  * `:partitions` - the number of partitions in the registry. Defaults to `1`.
  * `:listeners` - a list of named processes which are notified of register
    and unregister events. The registered process must be monitored by the
    listener if the listener wants to be notified if the registered process
    crashes. Messages sent to listeners are of type `t:listener_message/0`.
  * `:meta` - a keyword list of metadata to be attached to the registry.

For `:duplicate` registries, you can specify the partitioning strategy
directly in the `:keys` option:

  * `:duplicate` or `{:duplicate, :pid}` - Use `:pid` partitioning (default)
    when you have keys with many entries (e.g., one topic with many subscribers).
    This is the traditional behavior and groups all entries from the same process together.

  * `{:duplicate, :key}` - Use `:key` partitioning when entries are spread across
    many different keys (e.g., many topics with few subscribers each). This makes
    key-based lookups more efficient as they only need to check a single partition
    instead of all partitions. This option uses a different internal ETS table type
    (`ordered_set` instead of `duplicate_bag`), which means match specs passed to
    `select/2` and `count_select/2` that reference `:"$_"` may behave differently.
    Use named match variables (`:"$1"`, `:"$2"`, etc.) instead.

# `unregister`
*since 1.4.0* 

```elixir
@spec unregister(registry(), key()) :: :ok
```

Unregisters all entries for the given `key` associated to the current
process in `registry`.

Always returns `:ok` and automatically unlinks the current process from
the owner if there are no more keys associated to the current process. See
also `register/3` to read more about the "owner".

If the registry has listeners specified via the `:listeners` option in `start_link/1`,
those listeners will be notified of the unregistration and will receive a
message of type `t:listener_message/0`.

## Examples

For unique registries:

    iex> Registry.start_link(keys: :unique, name: Registry.UniqueUnregisterTest)
    iex> Registry.register(Registry.UniqueUnregisterTest, "hello", :world)
    iex> Registry.keys(Registry.UniqueUnregisterTest, self())
    ["hello"]
    iex> Registry.unregister(Registry.UniqueUnregisterTest, "hello")
    :ok
    iex> Registry.keys(Registry.UniqueUnregisterTest, self())
    []

For duplicate registries:

    iex> Registry.start_link(keys: :duplicate, name: Registry.DuplicateUnregisterTest)
    iex> Registry.register(Registry.DuplicateUnregisterTest, "hello", :world)
    iex> Registry.register(Registry.DuplicateUnregisterTest, "hello", :world)
    iex> Registry.keys(Registry.DuplicateUnregisterTest, self())
    ["hello", "hello"]
    iex> Registry.unregister(Registry.DuplicateUnregisterTest, "hello")
    :ok
    iex> Registry.keys(Registry.DuplicateUnregisterTest, self())
    []

# `unregister_match`
*since 1.5.0* 

```elixir
@spec unregister_match(registry(), key(), match_pattern(), guards()) :: :ok
```

Unregisters entries for keys matching a pattern associated to the current
process in `registry`.

## Examples

For unique registries it can be used to conditionally unregister a key on
the basis of whether or not it matches a particular value.

    iex> Registry.start_link(keys: :unique, name: Registry.UniqueUnregisterMatchTest)
    iex> Registry.register(Registry.UniqueUnregisterMatchTest, "hello", :world)
    iex> Registry.keys(Registry.UniqueUnregisterMatchTest, self())
    ["hello"]
    iex> Registry.unregister_match(Registry.UniqueUnregisterMatchTest, "hello", :foo)
    :ok
    iex> Registry.keys(Registry.UniqueUnregisterMatchTest, self())
    ["hello"]
    iex> Registry.unregister_match(Registry.UniqueUnregisterMatchTest, "hello", :world)
    :ok
    iex> Registry.keys(Registry.UniqueUnregisterMatchTest, self())
    []

For duplicate registries:

    iex> Registry.start_link(keys: :duplicate, name: Registry.DuplicateUnregisterMatchTest)
    iex> Registry.register(Registry.DuplicateUnregisterMatchTest, "hello", :world_a)
    iex> Registry.register(Registry.DuplicateUnregisterMatchTest, "hello", :world_b)
    iex> Registry.register(Registry.DuplicateUnregisterMatchTest, "hello", :world_c)
    iex> Registry.keys(Registry.DuplicateUnregisterMatchTest, self())
    ["hello", "hello", "hello"]
    iex> Registry.unregister_match(Registry.DuplicateUnregisterMatchTest, "hello", :world_a)
    :ok
    iex> Registry.keys(Registry.DuplicateUnregisterMatchTest, self())
    ["hello", "hello"]
    iex> Registry.lookup(Registry.DuplicateUnregisterMatchTest, "hello")
    [{self(), :world_b}, {self(), :world_c}]

# `update_value`
*since 1.4.0* 

```elixir
@spec update_value(registry(), key(), (value() -&gt; value())) ::
  {new_value :: term(), old_value :: term()} | :error
```

Updates the value for `key` for the current process in the unique `registry`.

Returns a `{new_value, old_value}` tuple or `:error` if there
is no such key assigned to the current process.

If a non-unique registry is given, an error is raised.

## Examples

    iex> Registry.start_link(keys: :unique, name: Registry.UpdateTest)
    iex> {:ok, _} = Registry.register(Registry.UpdateTest, "hello", 1)
    iex> Registry.lookup(Registry.UpdateTest, "hello")
    [{self(), 1}]
    iex> Registry.update_value(Registry.UpdateTest, "hello", &(&1 + 1))
    {2, 1}
    iex> Registry.lookup(Registry.UpdateTest, "hello")
    [{self(), 2}]

# `values`
*since 1.12.0* 

```elixir
@spec values(registry(), key(), pid()) :: [value()]
```

Reads the values for the given `key` for `pid` in `registry`.

For unique registries, it is either an empty list or a list
with a single element. For duplicate registries, it is a list
with zero, one, or multiple elements.

## Examples

In the example below we register the current process and look it up
both from itself and other processes:

    iex> Registry.start_link(keys: :unique, name: Registry.UniqueValuesTest)
    iex> Registry.values(Registry.UniqueValuesTest, "hello", self())
    []
    iex> {:ok, _} = Registry.register(Registry.UniqueValuesTest, "hello", :world)
    iex> Registry.values(Registry.UniqueValuesTest, "hello", self())
    [:world]
    iex> Task.async(fn -> Registry.values(Registry.UniqueValuesTest, "hello", self()) end) |> Task.await()
    []
    iex> parent = self()
    iex> Task.async(fn -> Registry.values(Registry.UniqueValuesTest, "hello", parent) end) |> Task.await()
    [:world]

The same applies to duplicate registries:

    iex> Registry.start_link(keys: :duplicate, name: Registry.DuplicateValuesTest)
    iex> Registry.values(Registry.DuplicateValuesTest, "hello", self())
    []
    iex> {:ok, _} = Registry.register(Registry.DuplicateValuesTest, "hello", :world)
    iex> Registry.values(Registry.DuplicateValuesTest, "hello", self())
    [:world]
    iex> {:ok, _} = Registry.register(Registry.DuplicateValuesTest, "hello", :another)
    iex> Enum.sort(Registry.values(Registry.DuplicateValuesTest, "hello", self()))
    [:another, :world]

---

*Consult [api-reference.md](api-reference.md) for complete listing*

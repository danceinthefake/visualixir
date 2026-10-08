<!-- source: https://elixir.hexdocs.pm/Process.md -->
# `Process`
[🔗](https://github.com/elixir-lang/elixir/blob/v1.20.4/lib/elixir/lib/process.ex#L5)

Conveniences for working with processes and the process dictionary.

Besides the functions available in this module, the `Kernel` module
exposes and auto-imports some basic functionality related to processes
available through the following functions:

  * `Kernel.spawn/1` and `Kernel.spawn/3`
  * `Kernel.spawn_link/1` and `Kernel.spawn_link/3`
  * `Kernel.spawn_monitor/1` and `Kernel.spawn_monitor/3`
  * `Kernel.self/0`
  * `Kernel.send/2`

While this module provides low-level conveniences to work with processes,
developers typically use abstractions such as `Agent`, `GenServer`,
`Registry`, `Supervisor` and `Task` for building their systems and
resort to this module for gathering information, trapping exits, links
and monitoring.

## Aliases

Aliases are a feature introduced in Erlang/OTP 24. An alias is a way
to refer to a PID in order to send messages to it. The advantage of using
aliases is that they can be deactivated even if the aliased process is still
running. If you send a message to a deactivated alias, nothing will happen.
This makes request/response scenarios easier to implement.

You can use `alias/0` or `alias/1` to set an alias, and then you can send
messages to that alias like you do with PIDs using `send/2`. To deactivate
an alias, you can use `unalias/1`. If you send a message to a deactivated alias,
nothing will happen.

For example, you could have a process that listens for `:ping` messages:

    def server do
      receive do
        {:ping, source_alias} ->
          send(source_alias, :pong)
          server()
      end
    end

Now, another process might ping this process:

    server = spawn(&server/0)

    source_alias = Process.alias()
    send(server, {:ping, source_alias})

    receive do
      :pong -> :pong
    end
    #=> :pong

If now you deactivate the `source_alias` and ping the server again, you
won't receive any response since the server will `send/2` the `:pong` response
to a deactivated alias.

    Process.unalias(source_alias)
    send(server, {:ping, source_alias})

    receive do
      :pong -> :pong
    after
      1000 -> :timeout
    end
    #=> :timeout

See also the [Process Aliases
section](https://www.erlang.org/doc/reference_manual/processes.html#process-aliases)
of the *Erlang reference manual*.

# `alias`

```elixir
@type alias() :: reference()
```

An alias returned by `alias/0` or `alias/1`.

See [the module documentation](#module-aliases) for more information about aliases.

# `alias_opt`

```elixir
@type alias_opt() :: :explicit_unalias | :reply
```

# `dest`

```elixir
@type dest() ::
  pid()
  | port()
  | (registered_name :: atom())
  | {registered_name :: atom(), node()}
```

A process destination.

A remote or local PID, a local port, a locally registered name, or a tuple in
the form of `{registered_name, node}` for a registered name at another node.

# `process_info_item`

```elixir
@type process_info_item() :: atom() | {:dictionary, term()}
```

# `process_info_result_item`

```elixir
@type process_info_result_item() :: {process_info_item(), term()}
```

# `spawn_opt`

```elixir
@type spawn_opt() ::
  :link
  | :monitor
  | {:monitor, :erlang.monitor_option()}
  | {:priority, :low | :normal | :high}
  | {:fullsweep_after, non_neg_integer()}
  | {:min_heap_size, non_neg_integer()}
  | {:min_bin_vheap_size, non_neg_integer()}
  | {:max_heap_size, heap_size()}
  | {:message_queue_data, :off_heap | :on_heap}
```

# `spawn_opts`

```elixir
@type spawn_opts() :: [spawn_opt()]
```

# `alias`
*since 1.15.0* 

```elixir
@spec alias() :: alias()
```

Creates a process alias.

This is the same as calling `alias/1` as `alias([:explicit_unalias])`. See
also `:erlang.alias/0`.

Inlined by the compiler.

## Examples

    alias = Process.alias()

# `alias`
*since 1.15.0* 

```elixir
@spec alias([alias_opt()]) :: alias()
```

Creates a process alias.

See [the module documentation](#module-aliases) for more information about aliases.
See also `:erlang.alias/1`.

Inlined by the compiler.

## Examples

    alias = Process.alias([:reply])

# `alive?`

```elixir
@spec alive?(pid()) :: boolean()
```

Tells whether the given process is alive on the local node.

If the process identified by `pid` is alive (that is, it's not exiting and has
not exited yet) then this function returns `true`. Otherwise, it returns
`false`.

`pid` must refer to a process running on the local node or `ArgumentError` is raised.
To check whether a process on any node is alive you can use the [`:erpc`](`:erpc`) module.

    :erpc.call(node(pid), Process, :alive?, [pid])

Inlined by the compiler.

# `cancel_timer`

```elixir
@spec cancel_timer(reference(), options) :: non_neg_integer() | false | :ok
when options: [async: boolean(), info: boolean()]
```

Cancels a timer returned by `send_after/3`.

When the result is an integer, it represents the time in milliseconds
left until the timer would have expired.

When the result is `false`, a timer corresponding to `timer_ref` could not be
found. This can happen either because the timer expired, because it has
already been canceled, or because `timer_ref` never corresponded to a timer.

Even if the timer had expired and the message was sent, this function does not
tell you if the timeout message has arrived at its destination yet.

Inlined by the compiler.

## Options

  * `:async` - (boolean) when `false`, the request for cancellation is
    synchronous. When `true`, the request for cancellation is asynchronous,
    meaning that the request to cancel the timer is issued and `:ok` is
    returned right away. Defaults to `false`.

  * `:info` - (boolean) whether to return information about the timer being
    cancelled. When the `:async` option is `false` and `:info` is `true`, then
    either an integer or `false` (like described above) is returned. If
    `:async` is `false` and `:info` is `false`, `:ok` is returned. If `:async`
    is `true` and `:info` is `true`, a message in the form `{:cancel_timer,
    timer_ref, result}` (where `result` is an integer or `false` like
    described above) is sent to the caller of this function when the
    cancellation has been performed. If `:async` is `true` and `:info` is
    `false`, no message is sent. Defaults to `true`.

# `delete`

```elixir
@spec delete(term()) :: term() | nil
```

Deletes the given `key` from the process dictionary.

Returns the value that was under `key` in the process dictionary,
or `nil` if `key` was not stored in the process dictionary.

## Examples

    iex> Process.put(:comments, ["comment", "other comment"])
    iex> Process.delete(:comments)
    ["comment", "other comment"]
    iex> Process.delete(:comments)
    nil

# `demonitor`

```elixir
@spec demonitor(reference(), options :: [:flush | :info]) :: boolean()
```

Demonitors the monitor identified by the given `reference`.

If `monitor_ref` is a reference which the calling process
obtained by calling `monitor/1`, that monitoring is turned off.
If the monitoring is already turned off, nothing happens.

See `:erlang.demonitor/2` for more information.

Inlined by the compiler.

## Examples

    pid = spawn(fn -> 1 + 2 end)
    ref = Process.monitor(pid)
    Process.demonitor(ref)
    #=> true

# `exit`

```elixir
@spec exit(pid(), term()) :: true
```

Sends an exit signal with the given `reason` to `pid`.

Exit behavior differs based on the value of `reason`:

  - If `:normal`, `pid` will not exit unless it is the calling process, in
    which case it will exit with the reason `:normal`. If it is trapping exits,
    the exit signal is transformed into a message `{:EXIT, from, :normal}` and
    delivered to its message queue.

  - If `:kill`, which occurs when `Process.exit(pid, :kill)` is called, an
    untrappable exit signal is sent to `pid` which will unconditionally exit
    with reason `:killed`.

  - If any other term and `pid` is not trapping exits, `pid` will exit with
    the given `reason`.

  - If any other term and `pid` is trapping exits, the exit signal is
    transformed into a message `{:EXIT, from, reason}` and delivered to its
    message queue.

Inlined by the compiler.

> #### Differences to `Kernel.exit/1` {: .info }
>
> The functions `Kernel.exit/1` and `Process.exit/2` are
> named similarly but provide very different functionalities. The
> `Kernel:exit/1` function should be used when the intent is to stop the current
> process while `Process.exit/2` should be used when the intent is to send an
> exit signal to another process. Note also that `Kernel.exit/1` can be caught
> with `try/1` while `Process.exit/2` can only be handled by trapping exits and
> when the signal is different than `:kill`.

## Examples

    Process.exit(pid, :kill)
    #=> true

# `flag`

```elixir
@spec flag(:error_handler, module()) :: module()
@spec flag(:max_heap_size, heap_size()) :: heap_size()
@spec flag(:message_queue_data, :off_heap | :on_heap) :: :off_heap | :on_heap
@spec flag(:min_bin_vheap_size, non_neg_integer()) :: non_neg_integer()
@spec flag(:min_heap_size, non_neg_integer()) :: non_neg_integer()
@spec flag(:priority, priority_level()) :: priority_level()
@spec flag(:save_calls, 0..10000) :: 0..10000
@spec flag(:sensitive, boolean()) :: boolean()
@spec flag(:trap_exit, boolean()) :: boolean()
```

Sets the given `flag` to `value` for the calling process.

Returns the old value of `flag`.

See `:erlang.process_flag/2` for more information.

Inlined by the compiler.

# `flag`

```elixir
@spec flag(pid(), :save_calls, 0..10000) :: 0..10000
```

Sets the given `flag` to `value` for the given process `pid`.

Returns the old value of `flag`.

It raises `ArgumentError` if `pid` is not a local process.

The allowed values for `flag` are only a subset of those allowed in `flag/2`,
namely `:save_calls`.

See `:erlang.process_flag/3` for more information.

Inlined by the compiler.

# `get`

```elixir
@spec get() :: [{term(), term()}]
```

Returns all key-value pairs in the process dictionary.

Inlined by the compiler.

# `get`

```elixir
@spec get(term(), default :: term()) :: term()
```

Returns the value for the given `key` in the process dictionary,
or `default` if `key` is not set.

## Examples

    # Assuming :locale was not set
    iex> Process.get(:locale, "pt")
    "pt"
    iex> Process.put(:locale, "fr")
    nil
    iex> Process.get(:locale, "pt")
    "fr"

# `get_keys`

```elixir
@spec get_keys() :: [term()]
```

Returns all keys in the process dictionary.

Inlined by the compiler.

## Examples

    # Assuming :locale was not set
    iex> :locale in Process.get_keys()
    false
    iex> Process.put(:locale, "pt")
    nil
    iex> :locale in Process.get_keys()
    true

# `get_keys`

```elixir
@spec get_keys(term()) :: [term()]
```

Returns all keys in the process dictionary that have the given `value`.

Inlined by the compiler.

# `get_label`
*since 1.20.0* 

```elixir
@spec get_label(pid()) :: term()
```

Returns the label set for the process `pid` as set with `set_label/1`
or `:proc_lib.set_label/1`.

Defaults to the current process when `pid` is not passed.

## Examples

    Process.set_label({:any, "term"})
    Process.get_label()
    #=> {:any, "term"}

Returns `nil` when not set:

    Process.get_label(pid)
    #=> nil

# `group_leader`

```elixir
@spec group_leader() :: pid()
```

Returns the PID of the group leader for the calling process.

Inlined by the compiler.

## Examples

    Process.group_leader()
    #=> #PID<0.53.0>

# `group_leader`

```elixir
@spec group_leader(pid(), leader :: pid()) :: true
```

Sets the group leader of the given `pid` to `leader`.

Typically, this is used when a process started from a certain shell should
have a group leader other than `:init`.

Inlined by the compiler.

# `hibernate`

```elixir
@spec hibernate(module(), atom(), list()) :: no_return()
```

Puts the calling process into a "hibernation" state.

The calling process is put into a waiting state
where its memory allocation has been reduced as much as possible,
which is useful if the process does not expect to receive any messages
in the near future.

See `:erlang.hibernate/3` for more information.

Inlined by the compiler.

# `info`

```elixir
@spec info(pid()) :: keyword() | nil
```

Returns information about the process identified by `pid`, or returns `nil` if the process
is not alive.

Use this only for debugging information.

See `:erlang.process_info/1` for more information.

# `info`

```elixir
@spec info(pid(), process_info_item()) :: process_info_result_item() | nil
@spec info(pid(), [process_info_item()]) :: [process_info_result_item()] | nil
```

Returns information about the process identified by `pid`,
or returns `nil` if the process is not alive.

See `:erlang.process_info/2` for more information.

# `link`

```elixir
@spec link(pid() | port()) :: true
```

Creates a link between the calling process and the given item (process or
port).

Links are bidirectional. Linked processes can be unlinked by using `unlink/1`.

If such a link exists already, this function does nothing since there can only
be one link between two given processes. If a process tries to create a link
to itself, nothing will happen.

When two processes are linked, each one receives exit signals from the other
(see also `exit/2`). Let's assume `pid1` and `pid2` are linked. If `pid2`
exits with a reason other than `:normal` (which is also the exit reason used
when a process finishes its job) and `pid1` is not trapping exits (see
`flag/2`), then `pid1` will exit with the same reason as `pid2` and in turn
emit an exit signal to all its other linked processes. The behavior when
`pid1` is trapping exits is described in `exit/2`.

See `:erlang.link/1` for more information.

Inlined by the compiler.

# `list`

```elixir
@spec list() :: [pid()]
```

Returns a list of PIDs corresponding to all the
processes currently existing on the local node.

Note that if a process is exiting, it is considered to exist but not be
alive. This means that for such process, `alive?/1` will return `false` but
its PID will be part of the list of PIDs returned by this function.

See `:erlang.processes/0` for more information.

Inlined by the compiler.

## Examples

    Process.list()
    #=> [#PID<0.0.0>, #PID<0.1.0>, #PID<0.2.0>, #PID<0.3.0>, ...]

# `monitor`

```elixir
@spec monitor(pid() | {name, node()} | name) :: reference() when name: atom()
```

Starts monitoring the given `item` from the calling process.

Once the monitored process dies, a message is delivered to the
monitoring process in the shape of:

    {:DOWN, ref, :process, object, reason}

where:

  * `ref` is a monitor reference returned by this function;
  * `object` is either a `pid` of the monitored process (if monitoring
    a PID) or `{name, node}` (if monitoring a remote or local name);
  * `reason` is the exit reason.

If the process is already dead when calling `Process.monitor/1`, a
`:DOWN` message is delivered immediately.

See ["Links and monitors"](genservers.md#links-and-monitors)
for an example. See `:erlang.monitor/2` for more information.

Inlined by the compiler.

## Examples

    pid = spawn(fn -> 1 + 2 end)
    #=> #PID<0.118.0>
    Process.monitor(pid)
    #=> #Reference<0.906660723.3006791681.40191>
    Process.exit(pid, :kill)
    #=> true
    receive do
      msg -> msg
    end
    #=> {:DOWN, #Reference<0.906660723.3006791681.40191>, :process, #PID<0.118.0>, :noproc}

# `monitor`
*since 1.15.0* 

```elixir
@spec monitor(pid() | {name, node()} | name, [:erlang.monitor_option()]) ::
  reference()
when name: atom()
```

Starts monitoring the given `item` from the calling process.

This function is similar to `monitor/1`, but accepts options to customize how
`item` is monitored. See `:erlang.monitor/3` for documentation on those
options.

Inlined by the compiler.

## Examples

    pid =
      spawn(fn ->
        receive do
          {:ping, source_alias} -> send(source_alias, :pong)
        end
      end)
    #=> #PID<0.118.0>

    ref_and_alias = Process.monitor(pid, alias: :reply_demonitor)
    #=> #Reference<0.906660723.3006791681.40191>

    send(pid, {:ping, ref_and_alias})

    receive do: (msg -> msg)
    #=> :pong

    ref_and_alias = Process.monitor(pid, alias: :reply_demonitor)
    #=> #Reference<0.906660723.3006791681.40191>

    send(pid, {:ping, ref_and_alias})

    receive do: (msg -> msg)
    #=> {:DOWN, #Reference<0.906660723.3006791681.40191>, :process, #PID<0.118.0>, :noproc}

# `put`

```elixir
@spec put(term(), term()) :: term() | nil
```

Stores the given `key`-`value` pair in the process dictionary.

The return value of this function is the value that was previously stored
under `key`, or `nil` in case no value was stored under it.

## Examples

    # Assuming :locale was not set
    iex> Process.put(:locale, "en")
    nil
    iex> Process.put(:locale, "fr")
    "en"

# `read_timer`

```elixir
@spec read_timer(reference()) :: non_neg_integer() | false
```

Reads a timer created by `send_after/3`.

When the result is an integer, it represents the time in milliseconds
left until the timer will expire.

When the result is `false`, a timer corresponding to `timer_ref` could not be
found. This can be either because the timer expired, because it has already
been canceled, or because `timer_ref` never corresponded to a timer.

Even if the timer had expired and the message was sent, this function does not
tell you if the timeout message has arrived at its destination yet.

Inlined by the compiler.

# `register`

```elixir
@spec register(pid() | port(), atom()) :: true
```

Registers the given `pid_or_port` under the given `name` on the local node.

`name` must be an atom and can then be used instead of the
PID/port identifier when sending messages with `Kernel.send/2`.

`register/2` will fail with `ArgumentError` in any of the following cases:

  * the PID/Port is not existing locally and alive
  * the name is already registered
  * the `pid_or_port` is already registered under a different `name`

The following names are reserved and cannot be assigned to
processes nor ports:

  * `nil`
  * `false`
  * `true`
  * `:undefined`

## Examples

    Process.register(self(), :test)
    #=> true
    send(:test, :hello)
    #=> :hello
    send(:wrong_name, :hello)
    ** (ArgumentError) argument error

# `registered`

```elixir
@spec registered() :: [atom()]
```

Returns a list of names which have been registered using `register/2`.

Inlined by the compiler.

## Examples

    Process.register(self(), :test)
    Process.registered()
    #=> [:test, :elixir_config, :inet_db, ...]

# `send`

```elixir
@spec send(dest, msg, [option]) :: :ok | :noconnect | :nosuspend
when dest: dest(), msg: any(), option: :noconnect | :nosuspend
```

Sends a message to the given `dest`.

`dest` may be a remote or local PID, a local port, a locally
registered name, or a tuple in the form of `{registered_name, node}` for a
registered name at another node.

Inlined by the compiler.

## Options

  * `:noconnect` - when used, if sending the message would require an
    auto-connection to another node the message is not sent and `:noconnect` is
    returned.

  * `:nosuspend` - when used, if sending the message would cause the sender to
    be suspended the message is not sent and `:nosuspend` is returned.

Otherwise the message is sent and `:ok` is returned.

## Examples

    iex> Process.send({:name, :node_that_does_not_exist}, :hi, [:noconnect])
    :noconnect

# `send_after`

```elixir
@spec send_after(pid() | atom(), term(), non_neg_integer(), [option]) :: reference()
when option: {:abs, boolean()}
```

Sends `msg` to `dest` after `time` milliseconds.

If `dest` is a PID, it must be the PID of a local process, dead or alive.
If `dest` is an atom, it must be the name of a registered process
which is looked up at the time of delivery. No error is produced if the name does
not refer to a process.

The message is not sent immediately. Therefore, `dest` can receive other messages
in-between even when `time` is `0`.

This function returns a timer reference, which can be read with `read_timer/1`
or canceled with `cancel_timer/1`.

The timer will be automatically canceled if the given `dest` is a PID
which is not alive or when the given PID exits. Note that timers will not be
automatically canceled when `dest` is an atom (as the atom resolution is done
on delivery).

## Options

  * `:abs` - (boolean) when `false`, `time` is treated as relative to the
  current monotonic time. When `true`, `time` is the absolute value of the
  Erlang monotonic time at which `msg` should be delivered to `dest`.
  To read more about Erlang monotonic time and other time-related concepts,
  look at the documentation for the `System` module. Defaults to `false`.

## Examples

    timer_ref = Process.send_after(pid, :hi, 1000)

# `set_label`
*since 1.17.0* 

```elixir
@spec set_label(term()) :: :ok
```

Add a descriptive term to the current process.

The term does not need to be unique, and will be shown in Observer and in
crash logs.
This label may be useful for identifying a process as one of multiple in a
given role, such as `:queue_worker` or `{:live_chat, user_id}`.

## Examples

    Process.set_label(:worker)
    #=> :ok

    Process.set_label({:any, "term"})
    #=> :ok

# `sleep`

```elixir
@spec sleep(timeout()) :: :ok
```

Sleeps the current process for the given `timeout`.

`timeout` is either the number of milliseconds to sleep as an
integer or the atom `:infinity`. When `:infinity` is given,
the current process will sleep forever, and not
consume or reply to messages.

> #### Sleeping limit {: .info }
>
> Before Elixir v1.18, `sleep/1` did not accept integer timeout values greater
> than `16#ffffffff`, that is, `2^32-1`. Since Elixir v1.18, arbitrarily-high integer
> values are accepted.

**Use this function with extreme care**. For almost all situations
where you would use `sleep/1` in Elixir, there is likely a
more correct, faster and precise way of achieving the same with
message passing.

For example, if you are waiting for a process to perform some
action, it is better to communicate the progress of such action
with messages.

In other words, **do not**:

    Task.start_link(fn ->
      do_something()
      ...
    end)

    # Wait until work is done
    Process.sleep(2000)

But **do**:

    parent = self()

    Task.start_link(fn ->
      do_something()
      send(parent, :work_is_done)
      ...
    end)

    receive do
      :work_is_done -> :ok
    after
      # Optional timeout
      30_000 -> :timeout
    end

For cases like the one above, `Task.async/1` and `Task.await/2` are
preferred.

Similarly, if you are waiting for a process to terminate,
monitor that process instead of sleeping. **Do not**:

    Task.start_link(fn ->
      ...
    end)

    # Wait until task terminates
    Process.sleep(2000)

Instead **do**:

    {:ok, pid} =
      Task.start_link(fn ->
        ...
      end)

    ref = Process.monitor(pid)

    receive do
      {:DOWN, ^ref, _, _, _} -> :task_is_down
    after
      # Optional timeout
      30_000 -> :timeout
    end

# `spawn`

```elixir
@spec spawn((-&gt; any()), spawn_opts()) :: pid() | {pid(), reference()}
```

Spawns the given function according to the given options.

The result depends on the given options. In particular,
if `:monitor` is given as an option, it will return a tuple
containing the PID and the monitoring reference, otherwise
just the spawned process PID.

More options are available; for the comprehensive list of available options
check `:erlang.spawn_opt/4`.

Inlined by the compiler.

## Examples

    Process.spawn(fn -> 1 + 2 end, [:monitor])
    #=> {#PID<0.93.0>, #Reference<0.18808174.1939079169.202418>}
    Process.spawn(fn -> 1 + 2 end, [:link])
    #=> #PID<0.95.0>

# `spawn`

```elixir
@spec spawn(module(), atom(), list(), spawn_opts()) :: pid() | {pid(), reference()}
```

Spawns the given function `fun` from module `mod`, passing the given `args`
according to the given options.

The result depends on the given options. In particular,
if `:monitor` is given as an option, it will return a tuple
containing the PID and the monitoring reference, otherwise
just the spawned process PID.

It also accepts extra options, for the list of available options
check `:erlang.spawn_opt/4`.

Inlined by the compiler.

# `unalias`
*since 1.15.0* 

```elixir
@spec unalias(alias()) :: boolean()
```

Explicitly deactivates a process alias.

Returns `true` if `alias` was a currently-active alias for current processes,
or `false` otherwise.

See [the module documentation](#module-aliases) for more information about aliases.
See also `:erlang.unalias/1`.

Inlined by the compiler.

## Examples

    alias = Process.alias()
    Process.unalias(alias)
    #=> true

# `unlink`

```elixir
@spec unlink(pid() | port()) :: true
```

Removes the link between the calling process and the given item (process or
port).

If there is no such link, this function does nothing. If `pid_or_port` does
not exist, this function does not produce any errors and simply does nothing.

The return value of this function is always `true`.

See `:erlang.unlink/1` for more information.

Inlined by the compiler.

# `unregister`

```elixir
@spec unregister(atom()) :: true
```

Removes the registered `name`, associated with a PID
or a port identifier.

Fails with `ArgumentError` if the name is not registered
to any PID or port.

Inlined by the compiler.

## Examples

    Process.register(self(), :test)
    #=> true
    Process.unregister(:test)
    #=> true
    Process.unregister(:wrong_name)
    ** (ArgumentError) argument error

# `whereis`

```elixir
@spec whereis(atom()) :: pid() | port() | nil
```

Returns the PID or port identifier registered under `name` or `nil` if the
name is not registered.

See `:erlang.whereis/1` for more information.

## Examples

    Process.register(self(), :test)
    Process.whereis(:test)
    #=> #PID<0.84.0>
    Process.whereis(:wrong_name)
    #=> nil

---

*Consult [api-reference.md](api-reference.md) for complete listing*

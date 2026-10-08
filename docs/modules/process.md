# Process

Source: [Elixir docs, Process](https://elixir.hexdocs.pm/Process.html).

`Process` has conveniences for working with processes and the process dictionary. `Kernel` auto-imports the basics: `spawn/1,3`, `spawn_link/1,3`, `spawn_monitor/1,3`, `self/0` and `send/2`.
You normally build on `Agent`, `GenServer`, `Registry`, `Supervisor` and `Task`, and use `Process` for gathering information, trapping exits, links and monitoring.

## Exit signals

`Process.exit(pid, reason)` **sends an exit signal**. What happens depends on the reason and on whether the receiver traps exits:

<Diagram name="process/signals" caption="Only :kill ignores trapping." />

| Reason | Receiver not trapping exits | Receiver trapping exits |
|---|---|---|
| `:normal` | does not exit (unless it is the caller itself, which exits with `:normal`) | message `{:EXIT, from, :normal}` |
| `:kill` | exits with `:killed`, untrappable | exits with `:killed` |
| any other term | exits with that reason | message `{:EXIT, from, reason}` |

`Kernel.exit/1` stops the **current** process and can be caught with `try/1`. `Process.exit/2` sends a signal to **another** process, handled only by trapping exits, and never when the reason is `:kill`.
Trapping is set with `Process.flag(:trap_exit, true)`.

## Links and monitors

`Process.link/1` creates a **bidirectional** link between the caller and a process or port. Only one link exists between two processes, and a link to yourself does nothing. If one side exits with a reason other than `:normal`
and the other isn't trapping exits, the other exits with the same reason and signals its own links in turn. `Process.unlink/1` removes it and does nothing if there is no link.

`Process.monitor/1` watches a process **one way**. When it dies, the watcher gets `{:DOWN, ref, :process, object, reason}`, where `object` is the pid, or `{name, node}` when monitoring a name. If the process is already dead,
the `:DOWN` message arrives immediately. `Process.demonitor/2` turns it off, and does nothing if already off.

<Diagram name="process/link-monitor" caption="A link carries exit signals. A monitor carries one message." />

## Aliases

Aliases (Erlang/OTP 24 and later) are another way to address a pid. Unlike a pid, an alias can be **deactivated** while the process runs. A message sent to a deactivated alias does nothing, which makes request/response easier:

```elixir
def server do
  receive do
    {:ping, source_alias} ->
      send(source_alias, :pong)
      server()
  end
end

server = spawn(&server/0)
source_alias = Process.alias()
send(server, {:ping, source_alias})

receive do
  :pong -> :pong
end
#=> :pong
```

After `Process.unalias(source_alias)`, a second ping gets no response, because the `:pong` goes to a deactivated alias.

<Diagram name="process/alias" caption="Late replies to a deactivated alias are dropped." />

## Names, labels and the dictionary

`Process.register/2` registers a local pid or port under an **atom** name. It raises `ArgumentError` if the process isn't alive and local, the name is taken, or the process already has a name. `nil`, `false`, `true` and `:undefined`
are reserved. `Process.whereis/1` returns the pid or `nil`.

`Process.set_label/1` (since 1.17.0) adds a descriptive term, not necessarily unique, shown in Observer and in crash logs, for example `:queue_worker` or `{:live_chat, user_id}`. `Process.get_label/1` (since 1.20.0)
reads it back, `nil` if none is set.

The **process dictionary** is per-process key-value storage: `Process.put/2` returns the previous value or `nil`, and `Process.get/0,2` and `Process.get_keys/0,1` read it. `Process.group_leader/0,2` reads and sets the process's group leader.

## Timers

`Process.send_after(dest, msg, time)` delivers `msg` after `time` milliseconds, not immediately, even for `0`: the destination can receive other messages in between.

<Diagram name="process/timers" caption="read_timer and cancel_timer take the reference." />

If `dest` is a pid it must be local. The timer is cancelled automatically when the pid is not alive or exits. If `dest` is an atom, the name is looked up **at delivery**, no error is produced if nothing is registered,
and the timer is *not* cancelled automatically. `read_timer/1` and `cancel_timer/2` return the milliseconds left, or `false` if the timer expired, was cancelled or never existed. Even for an expired timer they cannot tell you
whether the message has arrived.

`Process.sleep/1` blocks the current process for a timeout or `:infinity`, in which case it neither consumes nor replies to messages. Use it with extreme care: to wait for work, communicate progress with messages instead.
Since Elixir v1.18 arbitrarily high integers are accepted.

## Flags, info and hibernation

`Process.flag/2` sets a flag for the calling process and returns the old value. The flags are `:error_handler`, `:max_heap_size`, `:message_queue_data`, `:min_bin_vheap_size`, `:min_heap_size`, `:priority`, `:save_calls`,
`:sensitive` and `:trap_exit`. See `:erlang.process_flag/2`. `Process.flag/3` sets only `:save_calls`, for another local process.

`Process.info/1,2` returns information about a process, `nil` if it's not alive. Use it only for debugging. `Process.alive?/1` checks a local process.

`Process.hibernate/3` puts the calling process in a waiting state with its memory reduced as much as possible, useful if it won't receive messages for a while.

<UnderTheHood>

**In short:** the "signal" is real: a process that traps exits gets an ordinary message, and hibernation really throws memory away.

**Trapping.** A process that trapped exits received `{:EXIT, from, :normal}` and `{:EXIT, from, :boom}` as messages. Without trapping, `Process.exit(pid, :normal)` left it alive and `Process.exit(pid, :boom)` ended it. A process trapping exits still died on `:kill`. A monitor on a dead process delivered `{:DOWN, ref, :process, pid, :noproc}` right away, and a message sent to a deactivated alias produced no answer.

**Hibernation.** A process that built a list of 50,000 integers and then waited held **1,573,960 bytes** (a heap of 75,113 words). The same work followed by `Process.hibernate/3` left **824 bytes** (a heap of 7 words), less than a fresh idle process at **2,632 bytes** (233 words). The hibernated process's status was `:waiting`.

<Diagram name="process/uth-hibernate" caption="Memory held by an idle process, from `Process.info/2`." />

*Sources:* `Process.info/2` on Elixir 1.20.4 with Erlang/OTP 29, 64-bit. Sizes are in bytes (`:memory`) and words (`:heap_size`, 8 bytes each). One run per figure.

</UnderTheHood>

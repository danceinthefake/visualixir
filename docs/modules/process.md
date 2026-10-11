---
source: https://elixir.hexdocs.pm/Process.html
---

# Process

Source: [Elixir docs, Process](https://elixir.hexdocs.pm/Process.html).

`Process` has conveniences for work with processes and the process dictionary. `Kernel` imports the basics automatically: `spawn/1,3`, `spawn_link/1,3`, `spawn_monitor/1,3`, `self/0`, and `send/2`. You normally build on `Agent`, `GenServer`, `Registry`, `Supervisor`, and `Task`. Use `Process` to gather information, trap exits, and work with links and monitors.

## Exit signals

`Process.exit(pid, reason)` **sends an exit signal**. What happens depends on the reason and on whether the receiver traps exits:

<Diagram name="process/signals" caption="Only :kill ignores trapping." />

| Reason | Receiver not trapping exits | Receiver trapping exits |
|---|---|---|
| `:normal` | does not exit (unless it is the caller itself, which exits with `:normal`) | message `{:EXIT, from, :normal}` |
| `:kill` | exits with `:killed`, and it cannot trap the signal | exits with `:killed` |
| any other term | exits with that reason | message `{:EXIT, from, reason}` |

`Kernel.exit/1` stops the **current** process, and `try/1` can catch it. `Process.exit/2` sends a signal to **another** process. Only a process that traps exits can handle the signal, and it never handles `:kill`. Set trapping with `Process.flag(:trap_exit, true)`.

## Links and monitors

`Process.link/1` creates a **bidirectional** link between the caller and a process or port. Only one link exists between two processes, and a link to yourself does nothing. If one side exits with a reason other than `:normal` and the other side does not trap exits, the other side exits with the same reason. It then signals its own links in turn. `Process.unlink/1` removes the link. It does nothing if there is no link.

`Process.monitor/1` watches a process **in one direction**. When the process dies, the watcher gets `{:DOWN, ref, :process, object, reason}`. `object` is the pid, or `{name, node}` when you monitor a name. If the process is already dead, the `:DOWN` message arrives immediately. `Process.demonitor/2` turns the monitor off. It does nothing if the monitor is already off.

<Diagram name="process/link-monitor" caption="A link carries exit signals. A monitor carries one message." />

## Aliases

Aliases (Erlang/OTP 24 and later) are another way to address a pid. Unlike a pid, you can **deactivate** an alias while the process runs. A message that you send to a deactivated alias does nothing. This makes request and response easier:

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

<Diagram steps name="process/alias" caption="The system drops late replies to a deactivated alias." />

## Names, labels, and the dictionary

`Process.register/2` registers a local pid or port under an **atom** name. It raises `ArgumentError` if the process is not alive and local, if the name is taken, or if the process already has a name. `nil`, `false`, `true`, and `:undefined` are reserved. `Process.whereis/1` returns the pid or `nil`.

`Process.set_label/1` (since 1.17.0) adds a descriptive term. The term does not need to be unique. Observer and crash logs show it, for example `:queue_worker` or `{:live_chat, user_id}`. `Process.get_label/1` (since 1.20.0) reads it back. It returns `nil` if no label is set.

The **process dictionary** is key-value storage for each process. `Process.put/2` returns the previous value or `nil`. `Process.get/0,2` and `Process.get_keys/0,1` read it. `Process.group_leader/0,2` reads and sets the group leader of the process.

## Timers

`Process.send_after(dest, msg, time)` delivers `msg` after `time` milliseconds. It is not immediate, also for `0`: the destination can receive other messages in between.

<Diagram name="process/timers" caption="read_timer and cancel_timer take the reference." />

If `dest` is a pid, it must be local. The system cancels the timer automatically when the pid is not alive or exits. If `dest` is an atom, the system looks up the name **at delivery**. It produces no error if nothing is registered, and it does *not* cancel the timer automatically. `read_timer/1` and `cancel_timer/2` return the milliseconds that are left, or `false` if the timer expired, was cancelled, or never existed. Even for an expired timer, they cannot tell you if the message has arrived.

`Process.sleep/1` blocks the current process for a timeout or `:infinity`. In the `:infinity` case, the process does not consume or reply to messages. Use it with extreme care. To wait for work, communicate progress with messages instead. Since Elixir v1.18, it accepts arbitrarily high integers.

## Flags, info and hibernation

`Process.flag/2` sets a flag for the calling process and returns the old value. The flags are `:error_handler`, `:max_heap_size`, `:message_queue_data`, `:min_bin_vheap_size`, `:min_heap_size`, `:priority`, `:save_calls`, `:sensitive`, and `:trap_exit`. See `:erlang.process_flag/2`. `Process.flag/3` sets only `:save_calls`, for another local process.

`Process.info/1,2` returns information about a process, or `nil` if the process is not alive. Use it only for debugging. `Process.alive?/1` checks a local process.

`Process.hibernate/3` puts the calling process in a waiting state with its memory reduced as much as possible. This is useful if the process will not receive messages for a while.

<UnderTheHood>

**In short:** the "signal" is real. A process that traps exits gets an ordinary message, and hibernation really throws memory away.

**Trapping.** A process that trapped exits received `{:EXIT, from, :normal}` and `{:EXIT, from, :boom}` as messages. Without trapping, `Process.exit(pid, :normal)` left it alive and `Process.exit(pid, :boom)` ended it. A process that traps exits still died on `:kill`. A monitor on a dead process delivered `{:DOWN, ref, :process, pid, :noproc}` immediately, and a message that we sent to a deactivated alias produced no answer.

**Hibernation.** A process built a list of 50,000 integers and then waited. It held **1,573,960 bytes** (a heap of 75,113 words). After the same work and `Process.hibernate/3`, it held **824 bytes** (a heap of 7 words). This is less than a new idle process with **2,632 bytes** (233 words). The status of the hibernated process was `:waiting`.

<Diagram name="process/uth-hibernate" caption="Memory that an idle process holds, from `Process.info/2`." />

*Sources:* `Process.info/2` on Elixir 1.20.4 with Erlang/OTP 29, 64-bit. The sizes are in bytes (`:memory`) and words (`:heap_size`, 8 bytes each). We made one run for each figure.

</UnderTheHood>

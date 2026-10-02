# Processes

Source: [Elixir guide, Processes](https://elixir.hexdocs.pm/processes.html).

All Elixir code runs inside processes. They are isolated, concurrent and talk by **message passing**. They are not OS processes:
they are so cheap that hundreds of thousands can run at once.

## Spawning

`spawn/1` runs a function in a new process and returns its PID. The process usually finishes before you can look:

```elixir
pid = spawn(fn -> 1 + 2 end)
Process.alive?(pid)    #=> false
self()                 #=> #PID<0.41.0>   (the current process)
```

## Sending and receiving

`send/2` puts a message in the recipient's **mailbox** and returns immediately. `receive/1` scans the mailbox for the first message that
matches one of its patterns (guards and multiple clauses work as in `case`). Messages that don't match stay put.

<Diagram name="processes/mailbox" caption="send never blocks. receive picks the first matching message." />

```elixir
send(self(), {:hello, "world"})
receive do
  {:hello, msg} -> msg
  {:world, _msg} -> "won't match"
end
#=> "world"
```

With no match the process waits. Add `after` for a timeout (`0` if you know the message is already there):

```elixir
receive do
  {:hello, msg} -> msg
after
  1_000 -> "nothing after 1s"
end
```

Putting it together, the parent hands its own pid to the child so the child can reply:

```elixir
parent = self()
spawn(fn -> send(parent, {:hello, self()}) end)
receive do
  {:hello, pid} -> "Got hello from #{inspect pid}"
end
```

In IEx, `flush/0` prints and empties the shell's mailbox.

<UnderTheHood>

**Who runs your process.** By default the VM starts one *scheduler*, an OS thread, for each logical processor (`:erlang.system_info(:schedulers)` is 16 on the machine this was written on). A scheduler runs one process at a time, taken from the front of its run queue. The VM counts *reductions*, roughly one per function call, and a process gets a fixed number per turn (`:erlang.system_info(:context_reductions)` is 4000). When they are used up it goes to the back of the queue, so one busy process can't hold a core. A process waiting in `receive` is not in a run queue and uses no CPU until a message arrives.

<Diagram name="processes/uth-scheduler" caption="A scheduler takes the next ready process, and a process that has used its reductions goes to the back." />

**What a process costs.** A new process gets a heap of 233 words (`Process.info(pid, :heap_size)`). Measured, an idle process used about 2.6 KB in total, and 20,000 of them averaged 2.7 KB each. The heap grows as needed, and each process's heap is garbage-collected on its own ([Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html)).

**What `send` does.** Processes share no memory. Sending a message copies the data into the receiver's heap, except for large binaries, which are shared by reference ([Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html)).

<Diagram name="processes/uth-message-copy" caption="A list is copied into the receiver's heap. A large binary is not: only a small reference is." />

```elixir
list = Enum.to_list(1..100_000)
:erts_debug.flat_size(list)          #=> 200000 words = 1.6 MB
# the receiver's Process.info(pid, :memory) went from 2632 to 1602656 bytes

big = :binary.copy("x", 10_000_000)
# the receiver's memory stayed at 2632 bytes after receiving it
```

Binaries of up to 64 bytes live on the heap and are copied like any other term. Larger ones are stored outside every heap and reference-counted ([Binary handling](https://www.erlang.org/doc/system/binaryhandling.html)). That is why a copy is cheap for a 10 MB binary and costly for a 100,000-element list. Numbers were measured with Erlang/OTP 29 on 64-bit Linux.

**Below the VM: the kernel and the CPU.** The VM is an ordinary Linux program made of OS threads: 48 on this machine, of which 16 are schedulers (`erts_sched_N`), 16 dirty CPU, 10 dirty IO and 6 helpers. Spawning 20,053 Elixir processes did not add a single thread. A process is only data, a few KB of heap and a mailbox, that a scheduler thread picks up and runs for a while. So two schedulers are at work, one inside the other. The VM decides which process runs next on each of its threads. The Linux kernel decides which CPU runs each of those threads ([sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)). The VM's 4000 reductions are its own limit and are separate from Linux, which can also pause a thread whenever it chooses.

<Diagram name="processes/uth-threads-cores" caption="Two schedulers: the VM picks the process, the Linux kernel picks the CPU." />

**Below the VM: the hardware.** This CPU, an AMD Ryzen 7 5700G, has 8 cores with 2 hardware threads each, so Linux sees 16 logical CPUs. That is why the VM started 16 schedulers. With 32 busy processes, the 16 scheduler threads were spread over 14 of the 16 logical CPUs (read from `/proc/self/task`). Sending the 1.6 MB list from the example above means reading it from the sender's heap and writing it into the receiver's, so all of it passes through the CPU's caches. 1.6 MB is more than a core's 512 KiB L2 cache, so it can't all stay in the nearest cache.

*Sources:* the Erlang docs linked above, and the [BEAM Book](https://blog.stenmans.org/theBeamBook/) for how schedulers treat a process that is waiting. The reduction count per turn is the value this OTP release reports and has changed between releases.

</UnderTheHood>

## Links

A failure in a plain `spawn/1` process only logs an error, because processes are isolated. To make one process's death reach another,
**link** them with `spawn_link/1` (or `Process.link/1`):

<Diagram name="processes/link" caption="Isolated by default. Linked when you want failure to propagate." />

We normally link processes to **supervisors**, which notice a death and start a replacement. That is why "fail fast / let it crash" works.

## Tasks

`Task.start/1` and `Task.start_link/1` build on `spawn`, return `{:ok, pid}` (so tasks fit in supervision trees) and give better error
reports. `Task.async/1` and `Task.await/1` add convenience on top.

## State

Where does state live? In a process that loops, holding the state as an argument:

```elixir
defmodule KV do
  def start_link do
    Task.start_link(fn -> loop(%{}) end)
  end

  defp loop(map) do
    receive do
      {:get, key, caller} ->
        send(caller, Map.get(map, key))
        loop(map)
      {:put, key, value} ->
        loop(Map.put(map, key, value))
    end
  end
end
```

<Diagram name="processes/kv-loop" caption="Loop, receive, act, loop again with the (possibly new) state." />

Use it by sending messages:

```elixir
{:ok, pid} = KV.start_link()
send(pid, {:put, :hello, :world})
send(pid, {:get, :hello, self()})
flush()   #=> :world
```

`Process.register(pid, :kv)` gives the process a name, so `send(:kv, …)` works for anyone. You rarely write this by hand:
`Agent` wraps state, `GenServer`, registries and more are all processes underneath.

```elixir
{:ok, pid} = Agent.start_link(fn -> %{} end)
Agent.update(pid, fn map -> Map.put(map, :hello, :world) end)
Agent.get(pid, fn map -> Map.get(map, :hello) end)   #=> :world
```

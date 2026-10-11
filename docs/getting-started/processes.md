# Processes

Source: [Elixir guide, Processes](https://elixir.hexdocs.pm/processes.html).

All Elixir code runs inside processes. Processes are isolated and concurrent, and they communicate by **message passing**. They are not OS processes. They are so cheap that hundreds of thousands of them can run at the same time.

## Spawning

`spawn/1` runs a function in a new process and returns its PID. The process usually finishes before you can look at it:

```elixir
pid = spawn(fn -> 1 + 2 end)
Process.alive?(pid)    #=> false
self()                 #=> #PID<0.41.0>   (the current process)
```

## Sending and receiving

`send/2` puts a message in the **mailbox** of the recipient and returns immediately. `receive/1` scans the mailbox for the first message that matches one of its patterns (guards and multiple clauses work as in `case`). Messages that do not match stay in the mailbox.

<Diagram name="processes/mailbox" caption="send never blocks. receive picks the first message that matches." />

```elixir
send(self(), {:hello, "world"})
receive do
  {:hello, msg} -> msg
  {:world, _msg} -> "won't match"
end
#=> "world"
```

If no message matches, the process waits. Add `after` for a timeout (use `0` if you know that the message is already there):

```elixir
receive do
  {:hello, msg} -> msg
after
  1_000 -> "nothing after 1s"
end
```

To put these together, the parent gives its own pid to the child, so that the child can reply:

```elixir
parent = self()
spawn(fn -> send(parent, {:hello, self()}) end)
receive do
  {:hello, pid} -> "Got hello from #{inspect pid}"
end
```

In IEx, `flush/0` prints and empties the mailbox of the shell.

<UnderTheHood>

**In short:** an Elixir process is data that the VM runs on a few OS threads, and Linux runs those threads on the cores of the CPU. A message copies its data from one process to another.

**Who runs your process.** By default, the VM starts one *scheduler*, an OS thread, for each logical processor. This is the documented default ([`+S`](https://www.erlang.org/doc/apps/erts/erl_cmd.html). On the machine where we wrote this, `:erlang.system_info(:schedulers)` is 16). A scheduler runs one process at a time, from the front of its run queue. The VM counts *reductions*, about one for each function call, and a process gets a fixed number of reductions for each turn (`:erlang.system_info(:context_reductions)` is 4000).

When the process uses all its reductions, it goes to the back of the queue, so one busy process cannot hold a core. A process that waits in `receive` is not in a run queue and uses no CPU until a message arrives.

<Diagram name="processes/uth-scheduler" caption="A scheduler takes the next ready process. A process that used its reductions goes to the back." />

**What a process costs.** A new process gets a heap of 233 words (`Process.info(pid, :heap_size)`). We measured that an idle process used about 2.6 KB in total, and 20,000 processes used 2.7 KB each on average. The guide says that the garbage collector increases the heap as necessary ([Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html)).

**What `send` does.** Processes share no memory. A message send copies the data into the heap of the receiver. Large binaries are the exception: the VM shares them by reference ([Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html)).

<Diagram name="processes/uth-message-copy" caption="The VM copies a list into the heap of the receiver. It does not copy a large binary. Only a small reference goes to the receiver." />

```elixir
list = Enum.to_list(1..100_000)
:erts_debug.flat_size(list)          #=> 200000 words = 1.6 MB
# the Process.info(pid, :memory) of the receiver went from 2632 to 1602656 bytes

big = :binary.copy("x", 10_000_000)
# the memory of the receiver stayed at 2632 bytes after it received the binary
```

Binaries of up to 64 bytes are on the heap and the VM copies them as it copies any other term. The VM stores larger binaries outside every heap and counts their references ([Binary handling](https://www.erlang.org/doc/system/binaryhandling.html)). For this reason, a copy is cheap for a binary of 10 MB and expensive for a list of 100,000 elements. We measured the numbers with Erlang/OTP 29 on 64-bit Linux.

**Below the VM: the kernel and the CPU.** The VM is an ordinary Linux program that has OS threads: 48 on this machine. Of these, 16 are schedulers (`erts_sched_N`), 16 are dirty CPU, 10 are dirty IO, and 6 are helpers. When we spawned 20,053 Elixir processes, the VM did not add one thread. A process is only data, a few KB of heap and a mailbox, that a scheduler thread picks up and runs for a while.

So two schedulers work, one inside the other. The VM decides which process runs next on each of its threads. The Linux kernel decides which CPU runs each of those threads ([sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)). The 4000 reductions of the VM are its own limit and are separate from Linux. Linux can also pause a thread at any time.

<Diagram name="processes/uth-threads-cores" caption="Two schedulers: the VM picks the process and the Linux kernel picks the CPU." />

**Below the VM: the hardware.** This CPU, an AMD Ryzen 7 5700G, has 8 cores with 2 hardware threads each, so Linux sees 16 logical CPUs. For this reason, the VM started 16 schedulers. With 32 busy processes, the 16 scheduler threads ran on 14 of the 16 logical CPUs (we read this from `/proc/self/task`). To send the 1.6 MB list from the example above, the VM reads it from the heap of the sender and writes it into the heap of the receiver. All of it passes through the caches of the CPU. 1.6 MB is more than the L2 cache of 512 KiB of one core, so it cannot all stay in the nearest cache.

*Sources:* the Erlang docs that we linked above, and the [BEAM Book](https://blog.stenmans.org/theBeamBook/) for how schedulers treat a process that waits. The number of reductions for each turn is the value that this OTP release reports. It has changed between releases.

</UnderTheHood>

## Links

A failure in a plain `spawn/1` process only logs an error, because processes are isolated. To make the death of one process reach another process, **link** them with `spawn_link/1` (or `Process.link/1`):

<Diagram name="processes/link" caption="Isolated by default. Linked when you want the failure to propagate." />

Normally, we link processes to **supervisors**. A supervisor notices a death and starts a replacement. For this reason, "fail fast and let it crash" works.

## Tasks

`Task.start/1` and `Task.start_link/1` use `spawn`. They return `{:ok, pid}` (so tasks fit in supervision trees) and give better error reports. `Task.async/1` and `Task.await/1` add more convenience.

## State

Where does the state live? It lives in a process that loops and holds the state as an argument:

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

<Diagram name="processes/kv-loop" caption="Loop, receive, act, and loop again with the (possibly new) state." />

Send messages to use it:

```elixir
{:ok, pid} = KV.start_link()
send(pid, {:put, :hello, :world})
send(pid, {:get, :hello, self()})
flush()   #=> :world
```

`Process.register(pid, :kv)` gives the process a name, so `send(:kv, …)` works for anyone. You will rarely write this by hand. `Agent` wraps state. `GenServer`, registries, and more are all processes underneath.

```elixir
{:ok, pid} = Agent.start_link(fn -> %{} end)
Agent.update(pid, fn map -> Map.put(map, :hello, :world) end)
Agent.get(pid, fn map -> Map.get(map, :hello) end)   #=> :world
```

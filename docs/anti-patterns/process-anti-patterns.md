# Process-related anti-patterns

Source: [Elixir guide, Process-related anti-patterns](https://elixir.hexdocs.pm/process-anti-patterns.html).

These anti-patterns are about processes and abstractions that use processes. There are four.

## Code organization by process

**Problem:** a process organizes code. It must model a runtime property (concurrency, shared resources, error isolation) instead. All calls to one process wait in its mailbox, and the mailbox becomes a bottleneck.

```elixir
defmodule Calculator do
  use GenServer
  def add(a, b, pid), do: GenServer.call(pid, {:add, a, b})
  def handle_call({:add, a, b}, _from, state), do: {:reply, a + b, state}
end
```

**Refactoring:** organize code with **modules and functions**:

```elixir
def add(a, b), do: a + b
```

A library must not force behavior such as parallelism on its users. Let them choose.

<Diagram name="process-anti-patterns/calculator" caption="Functions run in the caller. A process serializes all callers." />

<UnderTheHood>

**What the bottleneck looks like in numbers.** We wrote the `Calculator` of the chapter in both ways. One caller made 500,000 additions. The plain function took 20 to 30 ms, and `GenServer.call` took about 600 ms (two runs). Each call is two messages and a wait. With 16 callers at the same time, the difference grows. The function ran in every caller, on the scheduler where the caller ran, and did 8,000,000 additions in 230 to 280 ms.

All callers of the GenServer waited in one mailbox for one process. That process did 2,000,000 additions in 1.3 to 1.4 seconds. This is the "bottleneck" that the chapter names: a process handles one message at a time, however many cores there are. A GenServer is still the correct tool when you need what a process gives, such as state or serialized access. This test shows what it costs when you do not need it.

<Diagram name="process-anti-patterns/uth-bottleneck" caption="A function runs in each caller. A GenServer makes every caller wait in one queue." />

*Sources:* we measured with `:timer.tc/1` and `Task.async/1` on Erlang/OTP 29 with 16 logical CPUs. The timings change from machine to machine.

</UnderTheHood>

## Scattered process interfaces

**Problem:** many modules talk directly to an `Agent` or `GenServer`. This duplicates code and leaves the shape of the shared data uncontrolled, so a list, a map, and an integer can all end up in one agent.

```elixir
Agent.update(process, fn _list -> 123 end)                 # module A
Agent.update(process, fn content -> %{a: content} end)     # module B
Agent.update(process, fn content -> [:atom_value | content] end)  # module C
```

**Refactoring:** one module owns the interaction and limits the data format:

```elixir
defmodule Foo.Bucket do
  use Agent
  def start_link(_opts), do: Agent.start_link(fn -> %{} end)
  def get(bucket, key), do: Agent.get(bucket, &Map.get(&1, key))
  def put(bucket, key, value), do: Agent.update(bucket, &Map.put(&1, key, value))
end
```

The same is true for scattered `GenServer.call/3` and `cast/2`. `KV.Bucket` did this in the Mix & OTP guide.

<Diagram name="process-anti-patterns/scattered" caption="One module is the interface. All other modules call it." />

## Sending unnecessary data

**Problem:** the system **copies a message completely** into the receiving process (share-nothing). This covers `send/2`, `GenServer.call/3`, `start_link/3`, `spawn/1`, `Task.async/1`, and more. It is subtle with anonymous functions: the system copies everything that the closure **captures**.

```elixir
spawn(fn -> log_request_ip(conn) end)             # copies conn
spawn(fn -> log_request_ip(conn.remote_ip) end)   # still copies all of conn!
```

The second call also captures `conn`, and only extracts the field afterward.

**Refactoring:** send the minimum:

```elixir
ip_address = conn.remote_ip
spawn(fn -> log_request_ip(ip_address) end)
```

Alternatively, let the receiving process fetch what it needs, or share data that rarely changes with `:persistent_term`.

<Diagram name="process-anti-patterns/copying" caption="Copy the field and not the struct that contains it." />

<UnderTheHood>

**What the closure captures.** We built a stand-in for `conn`: a map of about 104 KB. A process that we spawned with `fn -> conn.remote_ip end` held 139 KB, because the closure carries the whole map and the spawn copies it into the new process. A process that we spawned with a closure over only `ip = conn.remote_ip` held 2 KB. The closure object and the data that it captured are one thing in memory, as in the Anonymous functions chapter, and all of it crosses to the other process.

<Diagram name="process-anti-patterns/uth-capture" caption="The system copies a closure with everything that it captured, so capture only what the process needs." />

*Sources:* we measured with `Process.info(pid, :memory)` and `:erts_debug.flat_size/1` on Erlang/OTP 29. The [Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html) describes message copying.

</UnderTheHood>

## Unsupervised processes

**Problem:** many long-running processes that you start outside a supervision tree are hard to observe, monitor, and control. Dependent processes need ad-hoc ordering, and nothing guarantees when they stop.

**Refactoring:** start every process in a supervision tree:

```elixir
children = [
  Counter,
  Supervisor.child_spec({Counter, name: :other_counter, initial_value: 15}, id: :other_counter)
]
Supervisor.start_link(children, strategy: :one_for_one, name: App.Supervisor)
```

You get a deterministic start order and a shutdown in reverse order for cleanup. You also get configurable strategies for failures and introspection (Phoenix LiveDashboard, `:observer`).

<Diagram name="process-anti-patterns/unsupervised" caption="The tree gives the start order, the shutdown order, and the visibility." />

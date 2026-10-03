# Process-related anti-patterns

Source: [Elixir guide, Process-related anti-patterns](https://elixir.hexdocs.pm/process-anti-patterns.html).

Anti-patterns about processes and process-based abstractions. Four of them.

## Code organization by process

**Problem:** using a process to organize code instead of to model a runtime property (concurrency, shared resources, error isolation). All calls to one process queue on its mailbox, which becomes a bottleneck.

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

A library shouldn't impose behavior such as parallelism on its users. Let them choose.

<Diagram name="process-anti-patterns/calculator" caption="Functions run in the caller. A process serializes everyone." />

<UnderTheHood>

**What the bottleneck looks like in numbers.** I wrote the chapter's `Calculator` both ways. With one caller making 500,000 additions, the plain function took 20 to 30 ms and `GenServer.call` about 600 ms (two runs): each call is two messages and a wait. With 16 callers at once the difference grows. The function ran in every caller, on whichever scheduler it was on, and did 8,000,000 additions in 230 to 280 ms. All callers of the GenServer queued on one mailbox and one process, which did 2,000,000 additions in 1.3 to 1.4 seconds. That is the "bottleneck" the chapter names: a process handles one message at a time, however many cores there are. A GenServer is still the right tool when you need what a process gives, such as state or serialising access, and this shows what it costs when you don't.

<Diagram name="process-anti-patterns/uth-bottleneck" caption="A function runs in each caller. A GenServer makes every caller wait in one queue." />

*Sources:* measured with `:timer.tc/1` and `Task.async/1` on Erlang/OTP 29 with 16 logical CPUs. Timings vary by machine.

</UnderTheHood>

## Scattered process interfaces

**Problem:** many modules talk directly to an `Agent` or `GenServer`. That duplicates code and leaves the shape of the shared data uncontrolled, so a list, a map and an integer can all end up in one agent.

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

The same goes for scattered `GenServer.call/3` and `cast/2`. This is what `KV.Bucket` did in the Mix & OTP guide.

<Diagram name="process-anti-patterns/scattered" caption="One module is the interface. Everything else calls it." />

## Sending unnecessary data

**Problem:** a message is **fully copied** into the receiving process (share-nothing). That covers `send/2`, `GenServer.call/3`, `start_link/3`, `spawn/1`, `Task.async/1` and more. It is subtle with anonymous functions: everything the closure **captures** is copied.

```elixir
spawn(fn -> log_request_ip(conn) end)             # copies conn
spawn(fn -> log_request_ip(conn.remote_ip) end)   # still copies all of conn!
```

The second still captures `conn`, and only extracts the field afterward.

**Refactoring:** send the minimum:

```elixir
ip_address = conn.remote_ip
spawn(fn -> log_request_ip(ip_address) end)
```

Or let the receiving process fetch what it needs, or share rarely changing data with `:persistent_term`.

<Diagram name="process-anti-patterns/copying" caption="Copy the field, not the struct that contains it." />

<UnderTheHood>

**What the closure captures.** I built a stand-in for `conn`: a map of about 104 KB. A process spawned with `fn -> conn.remote_ip end` held 139 KB, because the closure carries the whole map and spawning copies it into the new process. A process spawned with a closure over just `ip = conn.remote_ip` held 2 KB. The closure object and the data it captured are one thing in memory, as in the Anonymous functions chapter, and it all crosses to the other process.

<Diagram name="process-anti-patterns/uth-capture" caption="A closure is copied with everything it captured, so capture only what the process needs." />

*Sources:* measured with `Process.info(pid, :memory)` and `:erts_debug.flat_size/1` on Erlang/OTP 29. Message copying is documented in the [Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html).

</UnderTheHood>

## Unsupervised processes

**Problem:** many long-running processes started outside a supervision tree are hard to observe, monitor and control. Dependent processes need ad-hoc ordering, and nothing guarantees when they stop.

**Refactoring:** start every process in a supervision tree:

```elixir
children = [
  Counter,
  Supervisor.child_spec({Counter, name: :other_counter, initial_value: 15}, id: :other_counter)
]
Supervisor.start_link(children, strategy: :one_for_one, name: App.Supervisor)
```

You get a deterministic start order and a reverse-order shutdown for cleanup, configurable strategies for failures, and introspection (Phoenix LiveDashboard, `:observer`).

<Diagram name="process-anti-patterns/unsupervised" caption="Start order, shutdown order and visibility come from the tree." />

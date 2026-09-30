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

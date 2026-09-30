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

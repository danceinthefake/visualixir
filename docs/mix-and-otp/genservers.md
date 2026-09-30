# Client-server with GenServer

Source: [Elixir guide, Client-server with GenServer](https://elixir.hexdocs.pm/genservers.html).

The last feature: a client can `SUBSCRIBE shopping` and get real-time notifications (`milk SET TO 1`, `milk DELETED`) from a bucket anywhere in the cluster. Agents can't
receive messages, so `KV.Bucket` becomes a `GenServer`.

## Links and monitors

How do you know a process terminated? Two options:

- **Links** tie the fates of two processes: if one crashes, the other crashes too. Supervisors are the exception, because they trap exits with `Process.flag(:trap_exit, true)`.
- **Monitors** only observe. When the monitored process ends, for any reason, you get a message and nothing else happens.

<Diagram name="genservers/link-vs-monitor" caption="A link propagates failure. A monitor reports it." />

```elixir
pid = spawn(fn -> Process.sleep(5000) end)
Process.monitor(pid)
flush()   # nothing yet, then after five seconds:
#=> {:DOWN, #Reference<...>, :process, #PID<0.119.0>, :normal}
```

Monitors are how a bucket learns a subscriber went away, so it can stop sending to it. Otherwise the subscriber list would grow forever.

## GenServer callbacks

A GenServer is a process that calls a small set of functions under specific conditions. With an agent, client code and server code sit in one function. In a
GenServer they are split:

```elixir
# client
def put(bucket, key, value), do: GenServer.call(bucket, {:put, key, value})

# server callback
def handle_call({:put, key, value}, _from, state) do
  {:reply, :ok, Map.put(state, key, value)}
end
```

<Diagram name="genservers/callbacks" caption="Each kind of request has its own callback." />

`KV.Bucket` as a GenServer:

```elixir
defmodule KV.Bucket do
  use GenServer

  def start_link(opts), do: GenServer.start_link(__MODULE__, %{}, opts)
  def get(bucket, key), do: GenServer.call(bucket, {:get, key})
  def put(bucket, key, value), do: GenServer.call(bucket, {:put, key, value})
  def delete(bucket, key), do: GenServer.call(bucket, {:delete, key})

  @impl true
  def init(bucket), do: {:ok, %{bucket: bucket}}

  @impl true
  def handle_call({:get, key}, _from, state) do
    {:reply, get_in(state.bucket[key]), state}
  end

  def handle_call({:put, key, value}, _from, state) do
    {:reply, :ok, put_in(state.bucket[key], value)}
  end

  def handle_call({:delete, key}, _from, state) do
    {value, state} = pop_in(state.bucket[key])
    {:reply, value, state}
  end
end
```

`GenServer.start_link/3` takes the callback module, the argument for `init/1`, and options (such as `:name`). `start_link` runs on the client and `init/1`
on the server.

A **call** is synchronous, and the server must reply while the client waits. A **cast** is asynchronous, with no reply. Requests are handled in order. The state is now a
map with a `:bucket` key so it has room for subscribers, and `get_in/1`, `put_in/2` and `pop_in/1` reach into it.

## Subscriptions

```elixir
def subscribe(bucket), do: GenServer.cast(bucket, {:subscribe, self()})

@impl true
def handle_cast({:subscribe, pid}, state) do
  Process.monitor(pid)
  {:noreply, update_in(state.subscribers, &MapSet.put(&1, pid))}
end

@impl true
def handle_info({:DOWN, _ref, _type, pid, _reason}, state) do
  {:noreply, update_in(state.subscribers, &MapSet.delete(&1, pid))}
end
```

`init/1` adds `subscribers: MapSet.new()`, and `put` and `delete` broadcast to it:

```elixir
defp broadcast(state, message) do
  for pid <- state.subscribers, do: send(pid, message)
end
```

<Diagram name="genservers/subscribe-flow" caption="Subscribe by cast. Every change is broadcast. A dead subscriber is removed on :DOWN." />

Real code would use a `call` for `subscribe`, since it gives back-pressure. `cast` is used here to show the callback.

## Wiring it into the server

Parse `["SUBSCRIBE", bucket]` into `{:subscribe, bucket}` and add a `run` clause that subscribes, switches the socket to **active mode** and loops:

```elixir
def run({:subscribe, bucket}, socket) do
  lookup(bucket, fn pid ->
    KV.Bucket.subscribe(pid)
    :inet.setopts(socket, active: true)
    receive_messages(socket)
  end)
end

defp receive_messages(socket) do
  receive do
    {:put, key, value} ->
      :gen_tcp.send(socket, "#{key} SET TO #{value}\r\n")
      receive_messages(socket)
    {:delete, key} ->
      :gen_tcp.send(socket, "#{key} DELETED\r\n")
      receive_messages(socket)
    {:tcp_closed, ^socket} -> {:error, :closed}
    _ -> receive_messages(socket)
  end
end
```

`:gen_tcp.recv/3` is **passive mode**: it blocks until data arrives. In **active mode** the socket delivers `{:tcp, socket, data}` and `{:tcp_closed, socket}` to the process's mailbox, so
one process can receive TCP events and bucket messages together. Many systems use `active: :once` to avoid flooding the mailbox. Because the bucket monitors the process, closing the connection unsubscribes it.

<Diagram name="genservers/active-mode" caption="Bucket events and socket events arrive in the same mailbox." />

The subscription is also distributed: with two connected nodes, changes made on one are streamed to a subscriber on the other, because it's all message passing.

## call, cast or info?

| Callback | Use for |
|---|---|
| `handle_call/3` | Synchronous requests. The default: waiting for a reply gives back-pressure. |
| `handle_cast/2` | Asynchronous requests when you don't need a reply. Use sparingly: delivery isn't confirmed. |
| `handle_info/2` | Everything else: plain `send/2` messages and monitor `:DOWN` messages. |

## Agent or GenServer?

Agents are a subset of GenServers, and are built on them, like supervisors and `Registry`. GenServers are the essential building block for concurrent, fault-tolerant
systems. Some people never use agents, others use them for small bits of state. Either is fine.

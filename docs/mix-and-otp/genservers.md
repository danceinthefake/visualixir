# Client-server with GenServer

Source: [Elixir guide, Client-server with GenServer](https://elixir.hexdocs.pm/genservers.html).

The last feature is that a client can send `SUBSCRIBE shopping`. The client then gets real-time notifications (`milk SET TO 1`, `milk DELETED`) from a bucket anywhere in the cluster. An agent cannot receive messages, so `KV.Bucket` becomes a `GenServer`.

## Links and monitors

How do you know that a process ended? You have two options:

- **Links** tie two processes together. If one process crashes, the other process crashes too. Supervisors are the exception, because they trap exits with `Process.flag(:trap_exit, true)`.
- **Monitors** only observe. When the monitored process ends, for any reason, you get a message and nothing else happens.

<Diagram name="genservers/link-vs-monitor" caption="A link passes the failure on. A monitor reports it." />

```elixir
pid = spawn(fn -> Process.sleep(5000) end)
Process.monitor(pid)
flush()   # nothing yet, then after five seconds:
#=> {:DOWN, #Reference<...>, :process, #PID<0.119.0>, :normal}
```

A bucket uses monitors to learn that a subscriber went away. The bucket then stops sending messages to it. Without monitors, the list of subscribers grows without limit.

## GenServer callbacks

A GenServer is a process that calls a small set of functions under specific conditions. With an agent, the client code and the server code are in one function. In a GenServer, they are separate:

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

`GenServer.start_link/3` takes the callback module, the argument for `init/1`, and options (such as `:name`). `start_link` runs on the client and `init/1` runs on the server.

A **call** is synchronous. The server must reply while the client waits. A **cast** is asynchronous and has no reply. The server handles requests in order. The state is now a map with a `:bucket` key, so it has room for subscribers. `get_in/1`, `put_in/2`, and `pop_in/1` reach into the map.

<UnderTheHood>

**Why a long mailbox hurts.** The mailbox of a process is a queue in the order of arrival. `receive` looks at the messages from the front until one message matches. We measured a message that matched at the end of the mailbox. With 10 messages ahead of it, `receive` took less than a microsecond. With 10,000 messages ahead of it, it took about 40 microseconds. With 1,000,000 messages ahead of it, it took about 5 milliseconds (41 and 5,149 microseconds in one run, 40 and 4,919 in another).

A GenServer works through its mailbox in order. If a server gets requests faster than it handles them, every client waits behind the queue. `GenServer.call` also gives the caller a unique alias, and the server sends the reply to that alias. The trace in the agent example showed this. The alias prevents the reply from mixing with other messages.

<Diagram name="genservers/uth-mailbox" caption="A receive scans the mailbox from the front, so the cost grows with the number of messages ahead of it." />

*Sources:* we measured with a plain `receive` and `:timer.tc/1` on Erlang/OTP 29. The scan cost depends on the pattern and on the VM version.

</UnderTheHood>

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

<Diagram name="genservers/subscribe-flow" caption="A client subscribes with a cast. The bucket broadcasts every change. The bucket removes a dead subscriber on :DOWN." />

Real code uses a `call` for `subscribe`, because a call gives back-pressure. This example uses `cast` to show the callback.

## Wiring it into the server

Parse `["SUBSCRIBE", bucket]` into `{:subscribe, bucket}`. Then add a `run` clause that subscribes, switches the socket to **active mode**, and loops:

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

`:gen_tcp.recv/3` is **passive mode**. It blocks until data arrives. In **active mode**, the socket delivers `{:tcp, socket, data}` and `{:tcp_closed, socket}` to the mailbox of the process. One process can then receive TCP events and bucket messages together. Many systems use `active: :once` to prevent a flood in the mailbox. The bucket monitors the process, so when the connection closes, the bucket removes the subscription.

<Diagram name="genservers/active-mode" caption="Bucket events and socket events arrive in the same mailbox." />

The subscription also works across nodes. With two connected nodes, the changes on one node go to a subscriber on the other node, because everything is message passing.

## call, cast, or info?

| Callback | Use for |
|---|---|
| `handle_call/3` | Synchronous requests. This is the default, because the wait for a reply gives back-pressure. |
| `handle_cast/2` | Asynchronous requests when you do not need a reply. Use it rarely, because nothing confirms the delivery. |
| `handle_info/2` | All other messages: plain `send/2` messages and monitor `:DOWN` messages. |

## Agent or GenServer?

Agents are a subset of GenServers, and they use GenServers, as supervisors and `Registry` do. GenServers are the basic building block of concurrent, fault-tolerant systems. Some people never use agents. Others use agents for small amounts of state. Both choices are correct.

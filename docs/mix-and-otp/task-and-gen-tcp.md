# Task and gen_tcp

Source: [Elixir guide, Task and gen_tcp](https://elixir.hexdocs.pm/task-and-gen-tcp.html).

This chapter serves requests over TCP with the Erlang module `:gen_tcp`. It also explores `Task`. First, build an **echo server**.

A TCP server does three things:

1. **Listen** on a port and get a socket
2. **Accept** a client connection
3. **Read** a request and **write** a response

```elixir
defmodule KV.Server do
  require Logger

  def accept(port) do
    {:ok, socket} =
      :gen_tcp.listen(port, [:binary, packet: :line, active: false, reuseaddr: true])
    Logger.info("Accepting connections on port #{port}")
    loop_acceptor(socket)
  end

  defp loop_acceptor(socket) do
    {:ok, client} = :gen_tcp.accept(socket)
    serve(client)
    loop_acceptor(socket)
  end

  defp serve(socket) do
    socket |> read_line() |> write_line(socket)
    serve(socket)
  end

  defp read_line(socket) do
    {:ok, data} = :gen_tcp.recv(socket, 0)
    data
  end

  defp write_line(line, socket), do: :gen_tcp.send(socket, line)
end
```

These are the options. `:binary` gives binaries, not lists. `packet: :line` reads one line at a time. `active: false` blocks `recv` until data arrives. `reuseaddr: true` reuses the address if the listener crashes. To test, run `telnet 127.0.0.1 4040`. When the client quits, `recv` returns `{:error, :closed}`. The `{:ok, data}` match does not expect this value. A later section fixes this. A more urgent problem is that nothing supervises this code.

<UnderTheHood>

**In short:** your code asks the Linux kernel to do the networking. The process waits until the kernel reports that data arrived.

**What `:gen_tcp` asks the kernel for.** We traced an echo server and a client. The VM asked the Linux kernel, one step at a time, to do these things:

1. Create a socket.
2. Attach the socket to port 4747.
3. Start to listen, with room for 5 waiting connections.
4. Watch the socket for activity.

The sockets do not block. If the process asks for data that did not arrive yet, the kernel immediately answers "no data yet". The process then waits and uses no CPU. When the kernel reports that data arrived, the VM asks again and gets the line.

The kernel keeps the state and the buffers of the connection. `ss -tnm` showed a receive buffer limit of 128 KiB and a send buffer limit of about 2.5 MB.

**In the hardware.** This test used the loopback interface, so it did not use a network card. Over a real network, the packets also pass through the network card. We did not measure that part.

<Diagram name="task-and-gen-tcp/uth-socket" caption="To receive data, the process waits, the epoll of the kernel reports data, and the VM reads it." />

*Sources:* `strace -f -y -Y` and `ss` on Linux with Erlang/OTP 29. The calls that we saw were `socket`, `bind`, `listen(fd, 5)`, `epoll_ctl` (to watch a socket), `connect` that returned `EINPROGRESS`, and `recvfrom` that returned `EAGAIN`. The names of the socket calls are the names that Linux uses.

</UnderTheHood>

## Tasks

`Task.start_link/1` runs an existing function in a new process. That process can be part of a supervision tree. As a child spec, write `{Task, fn -> ... end}`:

```elixir
children = [
  {Registry, name: KV, keys: :unique},
  {DynamicSupervisor, name: KV.BucketSupervisor, strategy: :one_for_one},
  {Task, fn -> KV.Server.accept(4040) end}
]
```

This works, but only for **one client at a time**. `serve/1` runs inside the acceptor and never returns. A second client connects but gets no echo.

<Diagram name="task-and-gen-tcp/sequential" caption="serve loops forever, so the acceptor cannot accept again." />

## Flawed concurrency

Serve each client in a separate task:

```elixir
{:ok, pid} = Task.start_link(fn -> serve(client) end)
:ok = :gen_tcp.controlling_process(client, pid)
```

Two clients now work at the same time, until one client quits. There are two causes. The first cause is the unhandled `{:error, :closed}`. The second cause is that each task is **linked** to the acceptor. One crash then stops the acceptor and every other client.

<Diagram name="task-and-gen-tcp/flawed" caption="Links without a supervisor let one failure spread." />

The rule of the guide is to start processes as children of supervisors.

## A task supervisor

`Task.Supervisor` supervises tasks. It is better for this job than `DynamicSupervisor`. Add it before the acceptor, because the order matters. The acceptor must not accept requests before its supervisor and the buckets exist. The shutdown runs in the reverse order.

```elixir
{Task.Supervisor, name: KV.ServerSupervisor},
{Task, fn -> KV.Server.accept(4040) end}
```

```elixir
{:ok, pid} = Task.Supervisor.start_child(KV.ServerSupervisor, fn -> serve(client) end)
:ok = :gen_tcp.controlling_process(client, pid)
```

`controlling_process` makes the serving task the owner of the socket. Otherwise the acceptor owns every socket, and a crash of the acceptor closes all of them.

<Diagram name="task-and-gen-tcp/concurrent" caption="Each connection gets a separate supervised task. A crash stays in that task." />

## Restart strategies

The `:restart` key of the child spec says what happens after a crash:

| `:restart` | Restarts the process |
|---|---|
| `:permanent` | always, whatever the exit reason (the default) |
| `:transient` | only if it exits abnormally |
| `:temporary` | never |

`Task.child_spec/1` says `:temporary`. `KV.Bucket` says nothing, so it is `:permanent`. Are these values correct?

- **Buckets**: permanent. Users must not need to create them again.
- **Acceptor**: it is critical, because nobody can connect without it. It must be `:permanent`.
- **Connection tasks**: temporary. The cause can be the connection itself, and a restart then fails again.

Override the spec of the acceptor:

```elixir
Supervisor.child_spec({Task, fn -> KV.Server.accept(4040) end}, restart: :permanent)
```

<Diagram name="task-and-gen-tcp/restart-tree" caption="The numbers show the start order. The shutdown runs in the reverse order." />

## Production

A real TCP server runs a **pool** of acceptors. Each acceptor has its own supervisor (`PartitionSupervisor` can do this). In practice, use Ranch (Erlang) or Thousand Island (Elixir).

# Task and gen_tcp

Source: [Elixir guide, Task and gen_tcp](https://elixir.hexdocs.pm/task-and-gen-tcp.html).

This chapter serves requests over TCP with Erlang's `:gen_tcp` and explores `Task`. First an **echo server**.

A TCP server, in broad strokes, does three things:

1. **Listen** on a port and get hold of a socket
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

The options: `:binary` (binaries, not lists), `packet: :line` (one line at a time), `active: false` (block on `recv` until data arrives) and
`reuseaddr: true` (reuse the address if the listener crashes). Test with `telnet 127.0.0.1 4040`. When the client quits, `recv` returns
`{:error, :closed}`, which the `{:ok, data}` match doesn't expect. We'll fix that later. More urgent: nothing supervises this.

<UnderTheHood>

**What `:gen_tcp` asks the kernel for.** Tracing the echo server and a client with `strace -f -y -Y` showed, from a scheduler thread: `socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)`, `bind` to port 4747, `listen(fd, 5)` (the 5 is the queue of waiting connections, which `ss` also shows), and `epoll_ctl` registering each socket with the kernel's `epoll`. A `connect` returned `EINPROGRESS` and a `recvfrom` returned `EAGAIN` ("no data yet"): the sockets are non-blocking. The process that called `recv` simply waits, using no CPU, until `epoll` reports data, and the VM then calls `recvfrom` again and gets the line. The kernel holds the connection's state and buffers; `ss -tnm` showed a receive buffer limit of 128 KiB and a send buffer limit of about 2.5 MB.

**In the hardware.** This test used the loopback interface, so no network card was involved. Over a real network the packets also pass through the network card, which is outside what I measured here.

<Diagram name="task-and-gen-tcp/uth-socket" caption="Receiving: the process waits, the kernel's epoll reports data, and the VM reads it." />

*Sources:* `strace` and `ss` on Linux with Erlang/OTP 29. Socket call names are Linux's.

</UnderTheHood>

## Tasks

`Task.start_link/1` runs an existing function in a new process that can be part of a supervision tree. As a child spec, `{Task, fn -> ... end}`:

```elixir
children = [
  {Registry, name: KV, keys: :unique},
  {DynamicSupervisor, name: KV.BucketSupervisor, strategy: :one_for_one},
  {Task, fn -> KV.Server.accept(4040) end}
]
```

It works, but only for **one client at a time**: `serve/1` runs inside the acceptor and never returns, so a second client connects and gets no echo.

<Diagram name="task-and-gen-tcp/sequential" caption="serve loops forever, so the acceptor can't accept again." />

## Flawed concurrency

Serve each client in its own task:

```elixir
{:ok, pid} = Task.start_link(fn -> serve(client) end)
:ok = :gen_tcp.controlling_process(client, pid)
```

Two clients now work at once, until one quits. Two causes: the unhandled `{:error, :closed}`, and the fact that each task is **linked** to the acceptor,
so one crash takes the acceptor and every other client down.

<Diagram name="task-and-gen-tcp/flawed" caption="Links without a supervisor let one failure cascade." />

The rule of the guide: start processes as children of supervisors.

## A task supervisor

`Task.Supervisor` supervises tasks and is better suited than `DynamicSupervisor` here. Add it before the acceptor, because order matters: the acceptor must not
accept requests before its supervisor and buckets exist. Shutdown runs in reverse.

```elixir
{Task.Supervisor, name: KV.ServerSupervisor},
{Task, fn -> KV.Server.accept(4040) end}
```

```elixir
{:ok, pid} = Task.Supervisor.start_child(KV.ServerSupervisor, fn -> serve(client) end)
:ok = :gen_tcp.controlling_process(client, pid)
```

`controlling_process` makes the serving task the socket's owner. Otherwise the acceptor would own every socket, and its crash would close them all.

<Diagram name="task-and-gen-tcp/concurrent" caption="Each connection gets its own supervised task. A crash stays contained." />

## Restart strategies

What happens on a crash is part of the child spec's `:restart`:

| `:restart` | Restarts the process |
|---|---|
| `:permanent` | always, whatever the exit reason (the default) |
| `:transient` | only if it exits abnormally |
| `:temporary` | never |

`Task.child_spec/1` says `:temporary`, and `KV.Bucket` says nothing, so it is `:permanent`. Are those right?

- **Buckets**: permanent. Users shouldn't have to recreate them.
- **Acceptor**: it is critical, since nobody can connect without it. It must be `:permanent`.
- **Connection tasks**: temporary. The cause may be the connection itself, and restarting over it would fail again.

So override the acceptor's spec:

```elixir
Supervisor.child_spec({Task, fn -> KV.Server.accept(4040) end}, restart: :permanent)
```

<Diagram name="task-and-gen-tcp/restart-tree" caption="Numbers are start order. Shutdown goes in reverse." />

## Production

A real TCP server runs a **pool** of acceptors, each with its own supervisor (`PartitionSupervisor` could do it). In practice use Ranch (Erlang) or Thousand Island
(Elixir).

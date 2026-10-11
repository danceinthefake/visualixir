# Configuration and distribution

Source: [Elixir guide, Configuration and distribution](https://elixir.hexdocs.pm/config-and-distribution.html).

The code fixes the port of the server at 4040, so you cannot run the dev server and the tests at the same time. Fix this with configuration. Then use the configuration to run several nodes on one machine and make the store distributed.

## Application environment

Every application has its own configuration, the **application environment**. Create `config/runtime.exs`:

```elixir
import Config

port =
  cond do
    port_env = System.get_env("PORT") -> String.to_integer(port_env)
    config_env() == :test -> 4040
    true -> 4050
  end

config :kv, :port, port
```

<Diagram name="config-and-distribution/port-choice" caption="PORT has priority. Without PORT, tests use 4040 and everything else uses 4050." />

Read the value in `start/2` with `Application.fetch_env!(:kv, :port)`. `fetch_env!` raises an error if the key is missing, so an application with wrong configuration does not start.

## Compile time and runtime

The configuration has two entry points:

- **`config/config.exs`** is read at build time, before the compilation and before the dependencies load. It controls *how the code is compiled*. It cannot call your code.
- **`config/runtime.exs`** is read after the compilation. It can set *how the application runs*, for example with `System.get_env/1` or external configuration.

<Diagram name="config-and-distribution/config-files" caption="Two entry points. One is before the compilation and one is after." />

For runtime values, use `Application.fetch_env!/2` and related functions. `Application.compile_env/2` reads compile-time values. When they change, Elixir knows what to compile again.

## Distribution

A node is a VM with a name. Elixir processes are **location transparent**. This means that a message works in the same way if the recipient is local or on another node. Start named shells with `iex --sname foo` and `iex --sname bar`. Then spawn a process on another node:

```elixir
# in foo:
defmodule Hello do
  def world, do: IO.puts("hello world")
end

# in bar (Hello doesn't exist here):
Node.spawn_link(:"foo@computer-name", fn -> Hello.world() end)
#=> #PID<9014.59.0>
#   hello world
```

The code runs on `foo`, where `Hello` is defined, and the output returns to `bar`. The pid starts with `9014` and not `0`. This means that the pid belongs to another node. You can `send` to it and get replies as usual.

<Diagram name="config-and-distribution/nodes-rpc" caption="The process runs where the code is. Its output returns to the node that started it." />

<UnderTheHood>

**What crosses the wire.** Nodes are separate VMs that TCP connects. A node finds the port of another node through `epmd`, the Erlang Port Mapper Daemon. By default, `epmd` listens on port 4369. The connection then goes through a handshake and a cookie check ([distribution protocol](https://www.erlang.org/doc/apps/erts/erl_dist_protocol.html)). The node sends a term in the *external term format*. For `{:hello, "world", [1, 2, 3], %{a: 1}}`, `:erlang.term_to_binary/1` gave 36 bytes that begin with 131, the version byte of the format. The term on the heap uses 160 bytes ([format](https://www.erlang.org/doc/apps/erts/erl_ext_dist.html)). The other node decodes the term into its own heap. This is another copy.

**What that costs.** A call to another node on the same machine took about 50 microseconds (`:erpc.call/4`, average of 10,000 calls in one run). The same addition on the local node took about 0.016 microseconds. The remote call is a few thousand times slower, and this test used loopback with no real network.

<Diagram name="config-and-distribution/uth-wire" caption="The node encodes a term, sends it over TCP, and the other node decodes it into its own heap." />

*Sources:* we measured with `:peer`, `:erpc`, and `:timer.tc/1` on Erlang/OTP 29. `epmd` ran on port 4369.

</UnderTheHood>

## Distributed naming with :global

Start two nodes (`PORT=4100 iex --sname foo -S mix`, `PORT=4101 iex --sname bar -S mix`). From `foo`, create a bucket on `bar` with `:erpc.call(:"bar@computer-name", KV, :create_bucket, ["shopping"])`. This works, but `KV.lookup_bucket("shopping")` on `foo` returns `nil`. `Registry` is **local**, so each node sees only its own buckets.

The Erlang `:global` registry is distributed, and `:name` accepts it. Change one line:

```elixir
defp via(name), do: {:global, name}
```

<Diagram name="config-and-distribution/registry-vs-global" caption="The call is the same but the registry is different. Only :global sees the other node." />

Now `foo` finds the bucket on `bar`, and the key-value store is distributed.

## Node discovery and dependencies

`:global` needs the nodes to be connected. `:erpc.call` connected them automatically. This is acceptable in a shell but not across machines. Packages solve node discovery: `dns_cluster` (it comes with Phoenix) or `libcluster` for Kubernetes and cloud providers.

Add dependencies to `deps/0` in `mix.exs`:

```elixir
def deps do
  [{:dns_cluster, "~> 0.2"}]
end
```

`~>` means the latest 0.x release. A dependency can also come from Git (`git: "https://github.com/…"`). `mix.lock` makes builds repeatable, and you **must commit it**. The usual tasks are `mix deps.get` and `mix deps.update` (see `mix help`).

### Node.connect/1

This is a simple discovery method: a `NODES` environment variable that `runtime.exs` reads:

```elixir
nodes =
  System.get_env("NODES", "")
  |> String.split(",", trim: true)
  |> Enum.map(&String.to_atom/1)

config :kv, :nodes, nodes
```

Then connect at startup:

```elixir
for node <- Application.fetch_env!(:kv, :nodes), do: Node.connect(node)
```

```console
$ NODES="foo@computer-name,bar@computer-name" PORT=4040 iex --sname foo -S mix
$ NODES="foo@computer-name,bar@computer-name" PORT=4041 iex --sname bar -S mix
```

In production, use `--name` and fully qualified names. Connected nodes must share the same **cookie**. The cookie is a secret that Erlang uses to authorize the connection. On one machine, the nodes share it by default. When you deploy a cluster, you must set or share the cookie.

## Trade-offs

`:global` requires **all known nodes to agree** each time the system creates a bucket. If a node does not respond, for example in a network partition, the node must reconnect or the system must remove it before the registration can succeed. The registration gets slower as the cluster grows. Lookups stay cheap. Other registries, such as Syn, make different trade-offs.

Storage is another problem. When the nodes stop, the bucket data is lost, and each node keeps its own buckets. For this reason, production applications usually use a database. They use Elixir for the real-time, collaborative parts, such as tracking connected clients or telling users when a bucket changes. The next chapter builds this.

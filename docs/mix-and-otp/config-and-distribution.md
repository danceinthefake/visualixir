# Configuration and distribution

Source: [Elixir guide, Configuration and distribution](https://elixir.hexdocs.pm/config-and-distribution.html).

The server's port is hardcoded to 4040, so you can't run the dev server and the tests at once. Fix that with configuration, then use it to run several
nodes on one machine and make the store distributed.

## Application environment

Every application has its own configuration: the **application environment**. Create `config/runtime.exs`:

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

<Diagram name="config-and-distribution/port-choice" caption="PORT wins. Otherwise tests use 4040 and everything else 4050." />

Read it in `start/2` with `Application.fetch_env!(:kv, :port)`. `fetch_env!` raises if the key is missing, so a misconfigured app won't boot.

## Compile vs runtime

Two entry points:

- **`config/config.exs`** is read at build time, before compiling and before dependencies load. It controls *how code is compiled*, and can't call your code.
- **`config/runtime.exs`** is read after compilation, so it can configure *how the app runs*: `System.get_env/1`, external config.

<Diagram name="config-and-distribution/config-files" caption="Two entry points, one before compiling and one after." />

Use `Application.fetch_env!/2` (and friends) for runtime values. `Application.compile_env/2` reads compile-time values and lets Elixir track what to
recompile when they change.

## Distribution

Nodes are VMs with names. Elixir processes are **location transparent**: sending a message works the same whether the recipient is local or on another node. Start
named shells with `iex --sname foo` and `iex --sname bar`, then spawn a process on another node:

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

The code runs on `foo`, where `Hello` is defined, and the output comes back to `bar`. The pid starts with `9014` instead of `0`, meaning it belongs to another
node. You can `send` to it and get replies as usual.

<Diagram name="config-and-distribution/nodes-rpc" caption="The process runs where the code is. Its output returns to the spawning node." />

## Distributed naming with :global

Start two nodes (`PORT=4100 iex --sname foo -S mix`, `PORT=4101 iex --sname bar -S mix`) and create a bucket on `bar` from `foo` with
`:erpc.call(:"bar@computer-name", KV, :create_bucket, ["shopping"])`. It works, but `KV.lookup_bucket("shopping")` on `foo` returns `nil`. `Registry` is
**local**, so each node only sees its own buckets.

Erlang's `:global` registry is distributed and accepted by `:name`. Change one line:

```elixir
defp via(name), do: {:global, name}
```

<Diagram name="config-and-distribution/registry-vs-global" caption="Same call, different registry. Only :global sees the other node." />

Now `foo` finds the bucket that lives on `bar`, and the key-value store is distributed.

## Node discovery and dependencies

`:global` needs the nodes connected. `:erpc.call` connected them automatically, which is fine in a shell but not across machines. Packages solve discovery: `dns_cluster`
(shipped with Phoenix) or `libcluster` for Kubernetes and cloud providers.

Add dependencies to `deps/0` in `mix.exs`:

```elixir
def deps do
  [{:dns_cluster, "~> 0.2"}]
end
```

`~>` means the latest 0.x release. You can depend on Git too (`git: "https://github.com/…"`). `mix.lock` guarantees repeatable builds and **must be committed**. The usual tasks
are `mix deps.get` and `mix deps.update` (see `mix help`).

### Node.connect/1

A simple discovery of our own: a `NODES` environment variable, read in `runtime.exs`:

```elixir
nodes =
  System.get_env("NODES", "")
  |> String.split(",", trim: true)
  |> Enum.map(&String.to_atom/1)

config :kv, :nodes, nodes
```

and connect at startup:

```elixir
for node <- Application.fetch_env!(:kv, :nodes), do: Node.connect(node)
```

```console
$ NODES="foo@computer-name,bar@computer-name" PORT=4040 iex --sname foo -S mix
$ NODES="foo@computer-name,bar@computer-name" PORT=4041 iex --sname bar -S mix
```

In production use `--name` and fully qualified names. Connected nodes must share the same **cookie**, a secret Erlang uses to authorize the connection. It
is shared by default on one machine but must be set or shared when deploying a cluster.

## Trade-offs

`:global` requires **all known nodes to agree** whenever a bucket is created. An unresponsive node (say, a network partition) must reconnect or be removed before registration
succeeds, and registration gets slower as the cluster grows. Lookups stay cheap. Other registries (such as Syn) make different trade-offs.

Storage is another problem: when nodes stop, bucket data is lost, and each node keeps its own buckets. That is why production apps usually use a database and use Elixir for the
real-time, collaborative parts, such as tracking connected clients or notifying users when a bucket changes. That is what the next chapter builds.

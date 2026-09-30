# Simple state with agents

Source: [Elixir guide, Simple state with agents](https://elixir.hexdocs.pm/agents.html).

Elixir is immutable and shares nothing by default. To share state, processes send messages. You rarely write those processes by hand;
you use one of three abstractions:

- `Agent`: a simple wrapper around state.
- `GenServer`: a "generic server" that encapsulates state and offers sync and async calls, code reloading and more.
- `Task`: an asynchronous computation you can spawn now and read the result of later.

This chapter builds `KV.Bucket` with an agent.

## Agents 101

```elixir
{:ok, agent} = Agent.start_link(fn -> [] end)
Agent.update(agent, fn list -> ["eggs" | list] end)
Agent.get(agent, fn list -> list end)    #=> ["eggs"]
Agent.stop(agent)
```

`start_link/1` takes a function returning the initial state. `update/3` takes a function from the current state to the new one. `get/3` takes
a function from the state to the value to return. The state can become anything, so keep the Agent API inside **one module**:

<Diagram name="agents/bucket-api" caption="KV.Bucket hides the agent behind four functions." />

## The test first

```elixir
defmodule KV.BucketTest do
  use ExUnit.Case, async: true

  test "stores values by key" do
    {:ok, bucket} = KV.Bucket.start_link([])
    assert KV.Bucket.get(bucket, "milk") == nil

    KV.Bucket.put(bucket, "milk", 3)
    assert KV.Bucket.get(bucket, "milk") == 3
  end
end
```

`async: true` runs this test case in parallel with other async cases. Use it only when the test touches no global state (the file system, a
database).

## The implementation

```elixir
defmodule KV.Bucket do
  use Agent

  def start_link(opts) do
    Agent.start_link(fn -> %{} end, opts)
  end

  def get(bucket, key) do
    Agent.get(bucket, &Map.get(&1, key))
  end

  def put(bucket, key, value) do
    Agent.update(bucket, &Map.put(&1, key, value))
  end
end
```

`start_link/1` always takes a list of options, by convention, and forwards them to `Agent.start_link/2`. `use Agent` is a pattern the next chapter explains.

## Naming processes

Pass `name:` and use the name instead of the pid: `KV.Bucket.start_link(name: :shopping_list)`. Names are shared on the node, so two tests
starting `:shopping_list` at once would clash. Name test processes after the test itself with the test context:

```elixir
test "stores values by key on a named process", config do
  {:ok, _} = KV.Bucket.start_link(name: config.test)
  KV.Bucket.put(config.test, "milk", 3)
  assert KV.Bucket.get(config.test, "milk") == 3
end
```

## get_and_update

`Agent.get_and_update/2` reads and changes the state in one call. It suits `delete/2`, which returns the removed value:

```elixir
def delete(bucket, key) do
  Agent.get_and_update(bucket, &Map.pop(&1, key))
end
```

## Client and server

Everything **inside** the function you pass runs in the agent process, the *server*. Everything outside runs in the caller, the *client*.

<Diagram name="agents/client-server" caption="The function travels to the agent, runs there, and its result comes back." />

That matters for cost. `Process.sleep(1000)` on the client only delays that caller. On the server, it blocks every other request to that agent and
can make clients time out. GenServers, coming up, make the client/server split explicit.

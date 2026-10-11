# Simple state with agents

Source: [Elixir guide, Simple state with agents](https://elixir.hexdocs.pm/agents.html).

Elixir data is immutable and processes share nothing by default. To share state, processes send messages. You rarely write those processes by hand. Instead, you use one of three abstractions:

- `Agent`: a simple wrapper around state.
- `GenServer`: a "generic server" that holds state and offers sync and async calls, code reloading, and more.
- `Task`: an asynchronous computation. You start it now and read the result later.

This chapter builds `KV.Bucket` with an agent.

## Agents 101

```elixir
{:ok, agent} = Agent.start_link(fn -> [] end)
Agent.update(agent, fn list -> ["eggs" | list] end)
Agent.get(agent, fn list -> list end)    #=> ["eggs"]
Agent.stop(agent)
```

`start_link/1` takes a function that returns the initial state. `update/3` takes a function from the current state to the new state. `get/3` takes a function from the state to the value to return. The state can become anything, so keep the Agent API inside **one module**:

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

`async: true` runs this test case in parallel with other async cases. Use it only when the test does not touch global state, for example the file system or a database.

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

By convention, `start_link/1` takes a list of options and passes them to `Agent.start_link/2`. The next chapter explains `use Agent`.

## Naming processes

Pass `name:` and use the name instead of the pid: `KV.Bucket.start_link(name: :shopping_list)`. All processes on the node share the names. If two tests start `:shopping_list` at the same time, the names clash. To avoid this, name each test process after the test. Use the test context:

```elixir
test "stores values by key on a named process", config do
  {:ok, _} = KV.Bucket.start_link(name: config.test)
  KV.Bucket.put(config.test, "milk", 3)
  assert KV.Bucket.get(config.test, "milk") == 3
end
```

## get_and_update

`Agent.get_and_update/2` reads and changes the state in one call. Use it for `delete/2`, which returns the removed value:

```elixir
def delete(bucket, key) do
  Agent.get_and_update(bucket, &Map.pop(&1, key))
end
```

## Client and server

Everything **inside** the function that you pass runs in the agent process, the *server*. Everything outside the function runs in the caller, the *client*.

<Diagram name="agents/client-server" caption="The function goes to the agent and runs there. Its result comes back." />

This matters for cost. `Process.sleep(1000)` on the client delays only that caller. On the server, it blocks every other request to that agent, and clients can time out. GenServers, in a later chapter, make the client and server split explicit.

<UnderTheHood>

**What `Agent.get` sends.** We traced the agent process with `:erlang.trace/3`. One `Agent.get/2` is two messages. The agent receives `{:"$gen_call", {caller, alias}, {:get, fun}}`. Then the agent sends back the reply. The `fun` is inside the first message. As with any message, the system copies it into the mailbox of the agent, together with the values that it captured. The agent then runs the function against its own state. This is why everything inside the function happens in the agent.

<Diagram name="agents/uth-messages" caption="One Agent.get is two messages. The function goes to the agent and the reply comes back." />

*Sources:* we traced with `:erlang.trace(agent, true, [:send, :receive])` on Erlang/OTP 29. The shape of the message is an implementation detail of `GenServer`. It can change.

</UnderTheHood>

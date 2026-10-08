# Task

Source: [Elixir docs, Task](https://elixir.hexdocs.pm/Task.html) and [Task.Supervisor](https://elixir.hexdocs.pm/Task.Supervisor.html).

Tasks are processes meant to execute **one particular action** throughout their lifetime, often with little or no communication with other
processes. The most common use is turning sequential code into concurrent code:

```elixir
task = Task.async(fn -> do_some_work() end)
res = do_some_other_work()
res + Task.await(task)
```

A task started with `async` can be awaited by its caller process, and only by it. Compared to plain `spawn/1`, tasks carry monitoring metadata and log errors.

## async and await

`Task.async/1` creates a new process that is **linked and monitored** by the caller. When the action finishes, a message with the result goes to the caller. `Task.await/2`
reads it.

<Diagram name="task/async-await" caption="The task sends one reply message. A monitor also delivers a :DOWN message." />

Two things to keep in mind:

1. You **must await** a reply, because it is *always* sent. If you don't expect one, use `Task.start_link/1`.
2. Linking means that if the caller crashes, the task crashes, and vice versa. That is on purpose: if nobody is left to receive the result, there is no point in finishing.
   For a different behaviour, use supervised tasks.

Tasks are processes, so data is **copied** to them. In the example below the whole of `large_data` is copied into the task:

```elixir
large_data = fetch_large_data()
task = Task.async(fn -> do_some_work(large_data) end)
```

Either extract just the part you need before starting the task, or move the loading into the task:

```elixir
task = Task.async(fn ->
  large_data = fetch_large_data()
  do_some_work(large_data)
end)
```

<UnderTheHood>

**In short:** `Task.async` is a spawn with a link, a monitor and a promise of one message back. The caller's mailbox is the only place the result waits.

**What exists after `Task.async`.** Looking at both processes with `Process.info` showed what the docs describe. The task is linked to the caller and monitored by it, and its process dictionary has `$callers` and `$ancestors`, each holding the caller. Once the task finished and before `Task.await` ran, the caller's mailbox held **two** messages: `{ref, result}` and then `{:DOWN, ref, :process, pid, :normal}`. After `await` returned both were gone and the caller had no monitor left, so `await` removes the monitor and the `:DOWN` message along with the reply. A task started through a `Task.Supervisor` has the supervisor first in `$ancestors` and the caller in `$callers`.

**Where the copy happens.** A closure carries the variables it uses with it, and the new process gets its own copy of them. A list of 100,000 integers measured 200,000 words (a 64-bit word is 8 bytes, so about 1.6 MB), and the closure that captured it measured 200,003 words. Starting a task that used that list and awaiting it took **0.8 to 1 ms** after the first run. With a 10-element list it took **5 to 11 µs**. Building the same list inside the task took about 1.5 ms here, so on this machine copying was not the expensive choice. The advice in the docs still holds for data you only need part of, or data that is slow to produce.

<Diagram name="task/uth-async-state" caption="What the two processes hold once the task is done." />

*Sources:* `Process.info/2` and `:erts_debug.flat_size/1` on Elixir 1.20.4 with Erlang/OTP 29, AMD Ryzen 7 5700G. Timings are from four runs and vary by machine; the sizes in words do not.

</UnderTheHood>

## Waiting: await, yield, shutdown

`Task.await/2` takes a timeout in milliseconds or `:infinity`, default `5000`. If the task process dies, the caller exits with the same reason. If the timeout passes, the caller exits;
a linked task then exits too, while a task that traps exits or isn't linked keeps running. `await` works **once** per task.

To check more than once, use `Task.yield/2`. It returns `{:ok, reply}`, `nil` if nothing arrived in time (the monitor stays active, so you can call it again), or `{:exit, reason}` if the task already exited.

<Diagram name="task/timeouts" caption="await gives up by exiting the caller. yield gives you the choice." />

To stop a task that missed its deadline, chain `shutdown/1`. It also catches a reply that arrived in the meantime:

```elixir
case Task.yield(task, timeout) || Task.shutdown(task) do
  {:ok, result} -> result
  nil -> Logger.warning("Failed to get a result in #{timeout}ms")
end
```

To check on the task but leave it running, chain `Task.ignore/1` instead. `shutdown` unlinks the task and sends it a `:shutdown` exit signal, killing it if it doesn't exit within the timeout. With `:brutal_kill` it
is killed straight away.

## Many tasks: async_stream

`Task.async_stream/3` runs a function on each element of an enumerable, each in its own task, and returns a stream of `{:ok, value}` results:

```elixir
strings = ["long string", "longer string", "there are many of these"]
stream = Task.async_stream(strings, fn text -> text |> String.codepoints() |> Enum.count() end)
Enum.sum_by(stream, fn {:ok, num} -> num end)    #=> 47
```

| Option | Meaning | Default |
|---|---|---|
| `:max_concurrency` | most tasks running at once | `System.schedulers_online/0` |
| `:ordered` | emit results in input order (may buffer) | `true` |
| `:timeout` | most time each task may run | `5000` |
| `:on_timeout` | `:exit` ends the caller; `:kill_task` kills that task and emits `{:exit, :timeout}` | `:exit` |
| `:zip_input_on_exit` | on failure emit `{:exit, {input, reason}}` | `false` |

The tasks are linked to an intermediate process that is linked to the caller, so a task failure ends the caller and a caller failure ends all tasks. Even with `ordered: false`
the tasks still run asynchronously. If you need to process elements in order, use `Enum.map/2` or `Enum.each/2`.

## Supervised tasks

`Task.Supervisor` dynamically starts supervised tasks. Put it in your supervision tree and pass its name to the calls:

```elixir
Supervisor.start_link([
  {Task.Supervisor, name: MyApp.TaskSupervisor}
], strategy: :one_for_one)

Task.Supervisor.async(MyApp.TaskSupervisor, fn ->
  # Do something
end)
|> Task.await()
```

The docs encourage supervised tasks as much as possible: you see how many tasks are running, control how results, errors and timeouts are handled, and the supervisor guarantees
all tasks end within a configurable shutdown period when the application shuts down. Pick by what you need back:

<Diagram name="task/supervised" caption="Three ways to start a task under a Task.Supervisor." />

`Task.Supervisor` is a single process that starts the others. If it becomes a bottleneck, start several and pick one at random (the module docs describe the pattern).

### Tasks inside a GenServer

Don't `await` a long-running task inside an OTP behaviour. A `GenServer` receives two messages in `handle_info/2`: `{ref, result}` (the reply, where `ref` is `task.ref`) and
`{:DOWN, ref, :process, pid, reason}`. A `:DOWN` without a reply means the task crashed. Because `Task.async/1` links to the caller, prefer `Task.Supervisor.async_nolink/3` so a
crashing task doesn't take the server down.

### Distributed tasks

Start a `Task.Supervisor` on the remote node and call it as `{name, node}`. Use `Task.Supervisor.async/5` with an explicit module, function and arguments, not an anonymous function:

```elixir
# First on the remote node named :remote@local
Task.Supervisor.start_link(name: MyApp.DistSupervisor)

# Then on the local client node
supervisor = {MyApp.DistSupervisor, :remote@local}
Task.Supervisor.async(supervisor, MyMod, :my_fun, [arg1, arg2, arg3])
```

An anonymous function expects the same module version on every node involved.

## Static tasks under a Supervisor

`Task` implements `child_spec/1`, so a task can sit directly under a `Supervisor`:

```elixir
Supervisor.start_link([
  {Task, fn -> :some_work end}
], strategy: :one_for_one)
```

Useful for work during startup, like warming caches. Such tasks can't be awaited, because they aren't linked to a caller. The supervisor does not wait for the task to finish before starting the next
child, so for synchronous initialization use an `Agent` or a `GenServer`. To give a task its own module, `use Task` and call `Task.start_link(__MODULE__, :run, [arg])`.

Unlike `GenServer`, `Agent` and `Supervisor`, a task's default `:restart` is **`:temporary`**: it is not restarted even if it crashes. Use `use Task, restart: :transient` to restart it after a
non-successful exit, or `restart: :permanent` to always restart it.

## Ancestors and callers

Every process started by Elixir records its parent under `$ancestors` in the process dictionary. A task started with `Task.Supervisor.start_child/2` has the supervisor as its ancestor, because the
supervisor starts it. To track who asked for the work, the task also stores `$callers`, readable with `Process.get(:"$callers")`. It is `nil` or a list with the most recent caller first.
If a task crashes, the callers are in the log metadata under `:callers`.

<Diagram name="task/callers" caption="$ancestors points at who started the task. $callers points at who asked for it." />

---
source: https://elixir.hexdocs.pm/Task.html
---

# Task

Source: [Elixir docs, Task](https://elixir.hexdocs.pm/Task.html) and [Task.Supervisor](https://elixir.hexdocs.pm/Task.Supervisor.html).

Tasks are processes for **one particular action** during their lifetime. They often have little or no communication with other processes. The most common use is to turn sequential code into concurrent code:

```elixir
task = Task.async(fn -> do_some_work() end)
res = do_some_other_work()
res + Task.await(task)
```

The caller process can await a task that it started with `async`, and only the caller can do this. Compared to plain `spawn/1`, tasks carry monitoring metadata and log errors.

## async and await

`Task.async/1` creates a new process that the caller **links and monitors**. When the action finishes, a message with the result goes to the caller. `Task.await/2` reads it.

<Diagram steps name="task/async-await" caption="The task sends one reply message. A monitor also delivers a :DOWN message." />

Remember two things:

1. You **must await** a reply, because the task *always* sends it. If you do not expect a reply, use `Task.start_link/1`.
2. Because of the link, if the caller crashes, the task crashes, and the reverse is also true. This is on purpose: if nobody is left to receive the result, there is no reason to finish. For different behavior, use supervised tasks.

Tasks are processes, so the system **copies** data to them. In the example below, the system copies the whole of `large_data` into the task:

```elixir
large_data = fetch_large_data()
task = Task.async(fn -> do_some_work(large_data) end)
```

Either extract only the part that you need before you start the task, or move the loading into the task:

```elixir
task = Task.async(fn ->
  large_data = fetch_large_data()
  do_some_work(large_data)
end)
```

<UnderTheHood>

**In short:** `Task.async` is a spawn with a link, a monitor, and a promise of one message back. The result waits only in the mailbox of the caller.

**What exists after `Task.async`.** We looked at both processes with `Process.info`, and it showed what the docs describe. The task is linked to the caller and monitored by it. Its process dictionary has `$callers` and `$ancestors`, and each holds the caller. After the task finished and before `Task.await` ran, the mailbox of the caller held **two** messages: `{ref, result}` and then `{:DOWN, ref, :process, pid, :normal}`. After `await` returned, both were gone and the caller had no monitor left. This shows that `await` removes the monitor and the `:DOWN` message together with the reply. A task that starts through a `Task.Supervisor` has the supervisor first in `$ancestors` and the caller in `$callers`.

**Where the copy happens.** A closure carries the variables that it uses, and the new process gets its own copy of them. A list of 100,000 integers measured 200,000 words (a 64-bit word is 8 bytes, so about 1.6 MB), and the closure that captured it measured 200,003 words. A task that used that list, with the await, took **0.8 to 1 ms** after the first run. With a list of 10 elements, it took **5 to 11 µs**. When we built the same list inside the task, it took about 1.5 ms here, so on this machine the copy was not the expensive choice. The advice in the docs is still correct for data when you need only a part of it, or when it is slow to produce.

<Diagram name="task/uth-async-state" caption="What the two processes hold after the task is done." />

*Sources:* `Process.info/2` and `:erts_debug.flat_size/1` on Elixir 1.20.4 with Erlang/OTP 29, AMD Ryzen 7 5700G. The timings are from four runs and change from machine to machine. The sizes in words do not change.

</UnderTheHood>

## Wait: await, yield, shutdown

`Task.await/2` takes a timeout in milliseconds or `:infinity`, default `5000`. If the task process dies, the caller exits with the same reason. If the timeout passes, the caller exits. A linked task then exits too, but a task that traps exits or is not linked keeps running. `await` works **once** for each task.

To check more than once, use `Task.yield/2`. It returns `{:ok, reply}`. It returns `nil` if nothing arrived in time (the monitor stays active, so you can call it again). It returns `{:exit, reason}` if the task already exited.

<Diagram name="task/timeouts" caption="await gives up when it exits the caller. yield lets you choose." />

To stop a task that missed its deadline, chain `shutdown/1`. It also catches a reply that arrived in the meantime:

```elixir
case Task.yield(task, timeout) || Task.shutdown(task) do
  {:ok, result} -> result
  nil -> Logger.warning("Failed to get a result in #{timeout}ms")
end
```

To check on the task but leave it running, chain `Task.ignore/1` instead. `shutdown` unlinks the task and sends it a `:shutdown` exit signal. It kills the task if the task does not exit within the timeout. With `:brutal_kill`, it kills the task immediately.

## Many tasks: async_stream

`Task.async_stream/3` runs a function on each element of an enumerable, each in its own task, and returns a stream of `{:ok, value}` results:

```elixir
strings = ["long string", "longer string", "there are many of these"]
stream = Task.async_stream(strings, fn text -> text |> String.codepoints() |> Enum.count() end)
Enum.sum_by(stream, fn {:ok, num} -> num end)    #=> 47
```

| Option | Meaning | Default |
|---|---|---|
| `:max_concurrency` | the most tasks that run at the same time | `System.schedulers_online/0` |
| `:ordered` | emit results in the order of the input (can buffer) | `true` |
| `:timeout` | the most time that each task can run | `5000` |
| `:on_timeout` | `:exit` ends the caller. `:kill_task` kills that task and emits `{:exit, :timeout}` | `:exit` |
| `:zip_input_on_exit` | on failure, emit `{:exit, {input, reason}}` | `false` |

The tasks are linked to an intermediate process that is linked to the caller. A task failure ends the caller, and a caller failure ends all tasks. Even with `ordered: false`, the tasks still run asynchronously. If you must process elements in order, use `Enum.map/2` or `Enum.each/2`.

## Supervised tasks

`Task.Supervisor` starts supervised tasks dynamically. Put it in your supervision tree and pass its name to the calls:

```elixir
Supervisor.start_link([
  {Task.Supervisor, name: MyApp.TaskSupervisor}
], strategy: :one_for_one)

Task.Supervisor.async(MyApp.TaskSupervisor, fn ->
  # Do something
end)
|> Task.await()
```

The docs encourage supervised tasks as much as possible. You see how many tasks are running. You control how the system handles results, errors, and timeouts. The supervisor makes sure that all tasks end within a configurable shutdown period when the application shuts down. Choose by what you need back:

<Diagram name="task/supervised" caption="Three ways to start a task under a Task.Supervisor." />

`Task.Supervisor` is a single process that starts the others. If it becomes a bottleneck, start several and pick one at random (the module docs describe the pattern).

### Tasks inside a GenServer

Do not `await` a long-running task inside an OTP behaviour. A `GenServer` receives two messages in `handle_info/2`: `{ref, result}` (the reply, where `ref` is `task.ref`) and `{:DOWN, ref, :process, pid, reason}`. A `:DOWN` without a reply means that the task crashed. `Task.async/1` links to the caller, so prefer `Task.Supervisor.async_nolink/3`. Then a task that crashes does not stop the server.

### Distributed tasks

Start a `Task.Supervisor` on the remote node and call it as `{name, node}`. Use `Task.Supervisor.async/5` with an explicit module, function, and arguments, not an anonymous function:

```elixir
# First on the remote node named :remote@local
Task.Supervisor.start_link(name: MyApp.DistSupervisor)

# Then on the local client node
supervisor = {MyApp.DistSupervisor, :remote@local}
Task.Supervisor.async(supervisor, MyMod, :my_fun, [arg1, arg2, arg3])
```

An anonymous function expects the same module version on every node that is involved.

## Static tasks under a Supervisor

`Task` implements `child_spec/1`, so a task can be directly under a `Supervisor`:

```elixir
Supervisor.start_link([
  {Task, fn -> :some_work end}
], strategy: :one_for_one)
```

This is useful for work during startup, for example to warm caches. You cannot await such tasks, because they are not linked to a caller. The supervisor does not wait for the task to finish before it starts the next child, so for synchronous initialization use an `Agent` or a `GenServer`. To give a task its own module, call `use Task` and `Task.start_link(__MODULE__, :run, [arg])`.

Unlike `GenServer`, `Agent`, and `Supervisor`, the default `:restart` of a task is **`:temporary`**. The supervisor does not restart it, even if it crashes. Use `use Task, restart: :transient` to restart it after an unsuccessful exit, or `restart: :permanent` to always restart it.

## Ancestors and callers

Every process that Elixir starts records its parent under `$ancestors` in the process dictionary. A task that starts with `Task.Supervisor.start_child/2` has the supervisor as its ancestor, because the supervisor starts it. To track who asked for the work, the task also stores `$callers`, which you can read with `Process.get(:"$callers")`. It is `nil` or a list with the most recent caller first. If a task crashes, the callers are in the log metadata under `:callers`.

<Diagram name="task/callers" caption="$ancestors points to who started the task. $callers points to who asked for it." />

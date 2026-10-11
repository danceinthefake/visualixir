# try, catch, and rescue

Source: [Elixir guide, try, catch, and rescue](https://elixir.hexdocs.pm/try-catch-and-rescue.html).

Elixir has three error mechanisms: errors, throws, and exits.

<Diagram name="try-catch-and-rescue/mechanisms" caption="Three mechanisms. All of them are uncommon in everyday code." />

## Errors

Errors (exceptions) are for exceptional cases. Raise an error with `raise/1` or `raise/2`. Define your own error with `defexception`:

```elixir
raise "oops"                                  #=> ** (RuntimeError) oops
raise ArgumentError, message: "invalid argument foo"

defmodule MyError do
  defexception message: "default message"
end
raise MyError   #=> ** (MyError) default message
```

Rescue an error with `try/rescue`:

```elixir
try do
  raise "oops"
rescue
  e in RuntimeError -> e       # or only `RuntimeError -> "Error!"`
end
#=> %RuntimeError{message: "oops"}
```

### Rarely rescued: use tuples

Most functions return tagged tuples and let you choose with `case`:

```elixir
case File.read("hello") do
  {:ok, body} -> IO.puts("Success: #{body}")
  {:error, reason} -> IO.puts("Error: #{reason}")
end
```

By convention, `foo` returns `{:ok, result}` or `{:error, reason}`, and `foo!` returns the bare result or **raises** an error. When a missing file is really an error, use `File.read!/1`.

<Diagram name="try-catch-and-rescue/ok-vs-bang" caption="The trailing ! means: raise an error and do not return an error tuple." />

### Fail fast and let it crash

For *unexpected* failures, do not rescue the error. Let the process die. Processes share nothing, so a crash cannot corrupt another process, and a supervisor starts a new process. For *expected* failures, for example when a user types a wrong file name, use `File.read/1` and report the error.

<Diagram name="try-catch-and-rescue/let-it-crash" caption="A crash stays in one process. The supervisor restarts from a known state." />

### Reraise

Rescue the error to log it, and then raise it again:

```elixir
try do
  ... some code ...
rescue
  e ->
    Logger.error(Exception.format(:error, e, __STACKTRACE__))
    reraise e, __STACKTRACE__
end
```

Elixir uses `__STACKTRACE__` when it formats the error and when it raises the error again. The error is raised as it is, with its original value and origin. Use errors only for unexpected or exceptional situations. Never use them for flow control. For flow control, use throws.

<UnderTheHood>

**What `try` becomes.** `try ... rescue` marks a spot in the stack frame of the function, runs the body, and removes the mark if nothing went wrong. If the code raises an error, the VM unwinds the stack back to the nearest mark, builds the stacktrace, and jumps to the rescue code. A `try` that does not fail costs one slot in the frame and two instructions.

**The stacktrace has a limit.** The VM keeps at most 8 frames (`:erlang.system_flag(:backtrace_depth, n)` returns the old value, 8). We raised an error 1000 calls deep and called `__STACKTRACE__`. It still gave 8 frames. A very deep stack shows only its innermost calls, and the stacktrace stays a fixed size.

<Diagram name="try-catch-and-rescue/uth-try" caption="try marks a catch point. An error unwinds the stack back to that point." />

*Sources:* we read the instructions with `:beam_disasm` (`try`, `try_end`, `try_case`, and `build_stacktrace`) and measured the depth on Erlang/OTP 29 and Elixir 1.20.

</UnderTheHood>

## Throws

`throw` a value and `catch` it. Use it only when you cannot get a value in any other way, for example to leave `Enum.each/2`. In practice, `Enum.find/2` does it:

```elixir
Enum.find(-50..50, &(rem(&1, 13) == 0))   #=> -39
```

## Exits

When a process dies, it sends an `exit` signal, and supervisors listen for it. `exit/1` sends a signal explicitly, and `catch :exit, _` can catch it. This is even more rare than `try/catch`.

```elixir
def matched_catch do
  exit(:timeout)
catch
  :exit, :timeout -> {:error, :timeout}
end
```

## after, else, and the order

`try/after` cleans up if the block raised an error and if it did not. The guarantee is soft: if a linked process exits, `after` does not run. Files, ETS tables, and sockets are linked to the process, and the system closes them when the process crashes. `else` matches the result of the `do` block when the block finished without a throw or an error. Elixir does not catch errors inside `else`.

<Diagram name="try-catch-and-rescue/order" caption="after runs if the block failed and if it did not, and it never changes the returned value. The guarantee is soft: when a linked process exits, after does not run." />

For example, close a file even if the write to it fails:

```elixir
{:ok, file} = File.open("sample", [:utf8, :write])
try do
  IO.write(file, "olá")
  raise "oops, something went wrong"
after
  File.close(file)
end
#=> ** (RuntimeError) oops, something went wrong
```

A function body can omit the `try` line. Elixir wraps the body in a `try` when you give `after`, `rescue`, or `catch`:

```elixir
defmodule RunAfter do
  def without_even_trying do
    raise "oops"
  after
    IO.puts("cleaning up!")
  end
end

RunAfter.without_even_trying
# cleaning up!
#=> ** (RuntimeError) oops
```

```elixir
try do
  1 / 2
rescue
  ArithmeticError -> :infinity
else
  y when y < 1 and y > -1 -> :small
  _ -> :large
end
#=> :small
```

## Variable scope

As in `case` and `if`, nothing that you bind inside `try`, `rescue`, `catch`, `else`, or `after` leaks out. Return the value of the `try` instead:

```elixir
what_happened =
  try do
    raise "fail"
    :did_not_raise
  rescue
    _ -> :rescued
  end
#=> :rescued
```

Variables that you bind in the `try` body are not visible in `rescue`, `after`, or `else`. The body can fail before it binds them.

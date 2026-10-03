# try, catch, and rescue

Source: [Elixir guide, try, catch, and rescue](https://elixir.hexdocs.pm/try-catch-and-rescue.html).

Elixir has three error mechanisms: errors, throws and exits.

<Diagram name="try-catch-and-rescue/mechanisms" caption="Three mechanisms, all uncommon in everyday code." />

## Errors

Errors (exceptions) are for exceptional things. Raise with `raise/1` or `raise/2`; define your own with `defexception`:

```elixir
raise "oops"                                  #=> ** (RuntimeError) oops
raise ArgumentError, message: "invalid argument foo"

defmodule MyError do
  defexception message: "default message"
end
raise MyError   #=> ** (MyError) default message
```

Rescue with `try/rescue`:

```elixir
try do
  raise "oops"
rescue
  e in RuntimeError -> e       # or just `RuntimeError -> "Error!"`
end
#=> %RuntimeError{message: "oops"}
```

### Rarely rescued: use tuples

Most functions return tagged tuples and let you choose, with `case`:

```elixir
case File.read("hello") do
  {:ok, body} -> IO.puts("Success: #{body}")
  {:error, reason} -> IO.puts("Error: #{reason}")
end
```

By convention, `foo` returns `{:ok, result}` or `{:error, reason}`, and `foo!` returns the bare result or **raises**.
When a missing file really is an error, use `File.read!/1`.

<Diagram name="try-catch-and-rescue/ok-vs-bang" caption="The trailing ! means: raise instead of returning an error tuple." />

### Fail fast / let it crash

For *unexpected* failures, don't rescue: let the process die. Processes share nothing, so a crash can't corrupt another process, and a
supervisor starts a fresh one. For *expected* failures, like a user typing a wrong filename, use `File.read/1` and report it.

<Diagram name="try-catch-and-rescue/let-it-crash" caption="A crash is contained. The supervisor restarts from a known state." />

### Reraise

Rescue to log, then re-raise:

```elixir
try do
  ... some code ...
rescue
  e ->
    Logger.error(Exception.format(:error, e, __STACKTRACE__))
    reraise e, __STACKTRACE__
end
```

`__STACKTRACE__` is used both when formatting and when re-raising, so the exception is raised as is, with its original value and origin. Errors are reserved for unexpected or exceptional situations, never for flow control.
For that, there are throws.

<UnderTheHood>

**What `try` becomes.** The compiled code for `try ... rescue` (read with `:beam_disasm`) is `try`, which records a *catch point* in the function's stack frame, then the body, then `try_end` to remove the catch point when nothing went wrong. If an error is raised, the VM unwinds the stack back to the nearest catch point, builds the stacktrace (`build_stacktrace`) and jumps to `try_case`. A `try` that doesn't fail costs one frame slot and two instructions.

**The stacktrace is capped.** The VM keeps at most 8 frames (`:erlang.system_flag(:backtrace_depth, n)` returns the old value, 8). Raising 1000 calls deep and calling `__STACKTRACE__` still gave 8 frames. So a very deep stack shows only its innermost calls, and the stacktrace stays a fixed size.

<Diagram name="try-catch-and-rescue/uth-try" caption="try marks a catch point. An error unwinds the stack back to it." />

*Sources:* instructions read with `:beam_disasm`, depth measured on Erlang/OTP 29 and Elixir 1.20.

</UnderTheHood>

## Throws

`throw` a value and `catch` it. It's only for when a value can't be retrieved any other way, such as bailing out of `Enum.each/2`. In practice
`Enum.find/2` does it:

```elixir
Enum.find(-50..50, &(rem(&1, 13) == 0))   #=> -39
```

## Exits

When a process dies, it sends an `exit` signal, which supervisors listen for. `exit/1` sends one explicitly, and `catch :exit, _` can
catch it, though that's even rarer than `try/catch`.

```elixir
def matched_catch do
  exit(:timeout)
catch
  :exit, :timeout -> {:error, :timeout}
end
```

## after, else, and the order

`try/after` cleans up whether or not the block raised. It's a soft guarantee: if a linked process exits, `after` doesn't run.
Files, ETS tables and sockets are linked to the process and are closed anyway when it crashes. `else` matches the result of the `do` block
when it finished without a throw or an error, and errors inside `else` aren't caught.

<Diagram name="try-catch-and-rescue/order" caption="after runs whether or not the block failed, and never changes the returned value. It is a soft guarantee: a linked process exiting skips it." />

For example, close a file even if writing to it fails:

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

A function body can skip the `try` line. Elixir wraps the body in a `try` whenever `after`, `rescue` or `catch` is given:

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

Like `case` and `if`, nothing bound inside `try`, `rescue`, `catch`, `else` or `after` leaks out. Return the value of the `try` instead:

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

Variables bound in the `try` body aren't visible in `rescue`, `after` or `else` either: the body may have failed before they were bound.

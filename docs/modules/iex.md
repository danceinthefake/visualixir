# IEx

Source: [Elixir docs, IEx](https://hexdocs.pm/iex/IEx.html).

IEx is Elixir's interactive shell. Some features depend on your terminal: if you get a message that the smart terminal could not be run, some of them won't work.
Type `h()` for the helpers, which are documented in `IEx.Helpers`.

## Autocomplete, encoding and history

Type a module name, a dot and press tab (`Enum.<tab>`) to list its public functions. Functions annotated with `@doc false`, `@impl true`, or undocumented functions named like `__foo__` are not autocompleted.
IEx expects UTF-8 input and output. On Windows you may need `chcp 65001` before starting it. ANSI colours are enabled on most Unix terminals.

Shell history is off by default. Enable it when starting IEx, or for the whole system with `ERL_AFLAGS`:

```
$ iex --erl "-kernel shell_history enabled"
$ export ERL_AFLAGS="-kernel shell_history enabled"
```

## Expressions are evaluated, not compiled

The code in IEx is **evaluated**, not compiled, so benchmarks and profiling in the shell give skewed results. Never run them there.

An expression can span lines: `iex(1)> "ab` followed by `...(1)> c"` returns `"ab\nc"`. If you get stuck in an incomplete expression with no way out, a line with only `#iex:break` forces the shell back to its normal state
(it then prints `** (TokenMissingError) iex:1: incomplete expression`).

IEx evaluates input line by line. When the code seen so far is a complete expression at the end of a line, it runs at that point. So that a following line beginning with a binary operator such as `|>` or `++` still works,
IEx treats such a line as if it started with `v()`, the value of the previous expression:

```
iex(1)> [1, [2], 3]
[1, [2], 3]
iex(2)> |> List.flatten()
[1, 2, 3]
```

This fails with no previous expression (`** (RuntimeError) v(-1) is out of bounds`) and right after a match like `x = 42`. For the latter, wrap the pipeline in parentheses.
It does not work for `+` and `-`, because they're ambiguous with the unary operators.

## Leaving the shell

`Ctrl+C` opens the `BREAK` menu, where you can quit the shell, see process and ETS table information and more. To quit: type `q` and enter in that menu, press `Ctrl+C` twice, or press `Ctrl+\`.
If you are connected to a remote shell, the remote one stays alive after you disconnect.

## Switching shells with Ctrl+G

`Ctrl+G` opens the **User switch command** menu (type `h` for help). From there you can start a new shell and switch between shells:

```
User switch command
 --> s iex
 --> c
```

Shells are **isolated**: after `hello = :world` in the new shell, switching back with `c 1` and typing `hello` gives `** (CompileError) undefined variable "hello"`.
The same menu ends a stuck session: `i` interrupts the evaluator (for example in an infinite loop), then `c` reconnects.

<Diagram name="iex/shells" caption="Ctrl+G switches between shells. Each has its own variables." />

## Remote shells

Both nodes need names. Start one with `iex --sname foo` and define a module there:

```elixir
iex(foo@HOST)1> node()
:"foo@HOST"
iex(foo@HOST)2> Node.alive?()
true
iex(foo@HOST)3> defmodule Hello do
...(foo@HOST)3>   def world, do: "it works!"
...(foo@HOST)3> end
```

In another named shell `Hello.world()` is undefined. Connect from the User switch command with `r 'foo@HOST' 'Elixir.IEx'` and `c`, or directly with the shortcut:

```
$ iex --sname baz --remsh foo@HOST
```

<Diagram name="iex/remsh" caption="You type in one node. The code runs in the other." />

Supported: remsh from an Elixir node to an Elixir node, from a plain Erlang node to an Elixir node (through the `^G` menu), and from an Elixir node to a plain Erlang node (you get an `erl` shell there).
Connecting an Elixir shell to a remote node **without Elixir** is not supported. When remsh halts, the Elixir shell process exits with reason `:normal`.

## dbg, pry and breakpoints

IEx adds a `dbg` backend that can pause execution. Enable it with `iex --dbg pry` (in a project, `iex --dbg pry -S mix`). IEx asks permission, then starts a shell in the context of the function with its variables, imports and aliases.
You can only read existing values: you cannot reach private functions or change the execution, hence "pry". On a pipeline ending with `|> dbg()` you can pry each step. Type `n` for the next pipe, `continue` to run all steps while staying in the pried process, or `respawn` to leave it and start a new shell.
`IEx.pry/0` starts a session without `dbg`.

`IEx.break!/4` sets a breakpoint on a module, function and arity you can't edit:

```elixir
break! URI, :parse, 1          # stops once
break! URI, :parse, 1, 10      # stops 10 times
break! URI.parse/1             # Mod.fun/arity form
break! URI.parse("https" <> _, _)    # only when the first argument matches
```

<Diagram name="iex/pry" caption="Both routes end in a pry session. You leave it with continue or respawn." />

It loads a new version of the module in memory with line-by-line breakpoints. **Recompiling the module loses all breakpoints**. Unlike `dbg`, breakpoints carry no imports or aliases from the source. Only one breakpoint can be set per function, so
a second call with another pattern keeps just the last one. The default is one stop, and the module stays "instrumented" after all stops are used until you call `remove_breaks/1` (one module) or `remove_breaks/0` (all).
Helpers: `breaks/0`, `continue/0`, `n/0`, `next/0`, `open/0`, `reset_break/1`, `reset_break/3`, `respawn/0` and `whereami/1`.

Macros are mostly expanded at compile time and receive ASTs, not values, so a breakpoint pattern like `when pid == self()` on a macro is never reached. With tests, run `iex -S mix test --trace` so timeouts don't hit you.

<UnderTheHood>

**In short:** `IEx.break!` swaps the module in memory for a modified copy. The file on disk stays where it was.

**What changes.** Setting a breakpoint on `URI.parse/1` changed the loaded module's MD5 checksum (read with `URI.module_info(:md5)`), while `:code.is_loaded(URI)` kept pointing at the same `.beam` file, 54,764 bytes. After `remove_breaks` the checksum was the original again,
whether the breakpoint was removed for the one module or for all of them. This is consistent with the docs: the instrumented version lives in memory, and the module is back to normal when the instrumentation is removed.

<Diagram name="iex/uth-break" caption="The running module changes. The file does not." />

*Sources:* `module_info/1`, `:code.is_loaded/1` and `:code.get_object_code/1` on Elixir 1.20.4 with Erlang/OTP 29. The test ran `IEx.break!/4` from a script after starting the `:iex` application. No pry session was run.

</UnderTheHood>

## The .iex.exs file

On start IEx looks for a configured path, then a local `.iex.exs` in the working directory, then a global one in `IEX_HOME` (default `~`), and loads **the first it finds**. Its code is evaluated line by line as if typed in the shell, so loaded modules and bound variables are available after boot.

```elixir
# Load another ".iex.exs" file
import_file("~/.iex.exs")

# Import some module from lib that may not yet have been defined
import_if_available(MyApp.Mod)

# Print something before the shell starts
IO.puts("hello world")

# Bind a variable that'll be accessible in the shell
value = 13
```

<Diagram name="iex/dotiex" caption="Only the first file found is loaded." />

Choose another file with `config :iex, dot_iex: "PATH"`, `IEx.configure(dot_iex: "PATH")` or `--dot-iex`. For remote nodes the location is relative to the user who started the application, not the one connecting.

## Configuring the shell

`IEx.configure/1` (see `h IEx.configure/1`) takes options such as `:inspect`, `:colors`, `:width`, `:history_size`, `:default_prompt`, `:alive_prompt`, `:auto_reload`, `:dot_iex` and `:parser`. Put it in a `.iex.exs`:

```elixir
IEx.configure(inspect: [limit: 3])
```

Now `[1, 2, 3, 4, 5]` prints as `[1, 2, 3, ...]`.

---
source: https://hexdocs.pm/iex/IEx.html
---

# IEx

Source: [Elixir docs, IEx](https://hexdocs.pm/iex/IEx.html).

IEx is the interactive shell of Elixir. Some features depend on your terminal. If you get a message that the smart terminal could not be run, some features do not work. Type `h()` for the helpers, which `IEx.Helpers` documents.

## Autocomplete, encoding, and history

Type a module name, a dot, and press tab (`Enum.<tab>`) to list its public functions. IEx does not autocomplete functions with `@doc false`, `@impl true`, or undocumented functions with names such as `__foo__`. IEx expects UTF-8 input and output. On Windows, you can need `chcp 65001` before you start it. ANSI colors are enabled on most Unix terminals.

Shell history is off by default. Enable it when you start IEx, or for the whole system with `ERL_AFLAGS`:

```
$ iex --erl "-kernel shell_history enabled"
$ export ERL_AFLAGS="-kernel shell_history enabled"
```

## IEx evaluates expressions and does not compile them

The code in IEx is **evaluated** and not compiled, so benchmarks and profiling in the shell give results that are not correct. Never run them there.

An expression can use several lines: `iex(1)> "ab` followed by `...(1)> c"` returns `"ab\nc"`. If you are stuck in an incomplete expression with no way out, a line with only `#iex:break` forces the shell back to its normal state. The shell then prints `** (TokenMissingError) iex:1: incomplete expression`.

IEx evaluates input line by line. When the code so far is a complete expression at the end of a line, it runs at that point. A following line can begin with a binary operator such as `|>` or `++` and still work. For this, IEx treats such a line as if it started with `v()`, the value of the previous expression:

```
iex(1)> [1, [2], 3]
[1, [2], 3]
iex(2)> |> List.flatten()
[1, 2, 3]
```

This fails when there is no previous expression (`** (RuntimeError) v(-1) is out of bounds`) and right after a match such as `x = 42`. For the match case, wrap the pipeline in parentheses. It does not work for `+` and `-`, because they are ambiguous with the unary operators.

## Leave the shell

`Ctrl+C` opens the `BREAK` menu. In this menu, you can quit the shell, see information about processes and ETS tables, and more. To quit, type `q` and enter in that menu, press `Ctrl+C` twice, or press `Ctrl+\`. If you are connected to a remote shell, the remote shell stays alive after you disconnect.

## Switch shells with Ctrl+G

`Ctrl+G` opens the **User switch command** menu (type `h` for help). From there, you can start a new shell and switch between shells:

```
User switch command
 --> s iex
 --> c
```

Shells are **isolated**. After `hello = :world` in the new shell, you switch back with `c 1`, and `hello` gives `** (CompileError) undefined variable "hello"`. The same menu ends a stuck session: `i` interrupts the evaluator (for example in an infinite loop), and then `c` reconnects.

<Diagram name="iex/shells" caption="Ctrl+G switches between shells. Each shell has its own variables." />

## Remote shells

Both nodes need names. Start one node with `iex --sname foo` and define a module there:

```elixir
iex(foo@HOST)1> node()
:"foo@HOST"
iex(foo@HOST)2> Node.alive?()
true
iex(foo@HOST)3> defmodule Hello do
...(foo@HOST)3>   def world, do: "it works!"
...(foo@HOST)3> end
```

In another named shell, `Hello.world()` is undefined. Connect from the User switch command with `r 'foo@HOST' 'Elixir.IEx'` and `c`, or directly with the shortcut:

```
$ iex --sname baz --remsh foo@HOST
```

<Diagram name="iex/remsh" caption="You type in one node. The code runs in the other node." />

These connections are supported: from an Elixir node to an Elixir node, and from a plain Erlang node to an Elixir node (through the `^G` menu). You can also connect from an Elixir node to a plain Erlang node. You get an `erl` shell there. It is not supported to connect an Elixir shell to a remote node **without Elixir**. When remsh halts, the Elixir shell process exits with reason `:normal`.

## dbg, pry and breakpoints

IEx adds a `dbg` backend that can pause the execution. Enable it with `iex --dbg pry` (in a project, `iex --dbg pry -S mix`). IEx asks for permission, and then starts a shell in the context of the function with its variables, imports, and aliases. You can only read existing values. You cannot reach private functions or change the execution, and so the name is "pry". On a pipeline that ends with `|> dbg()`, you can pry each step. Type `n` for the next pipe. Type `continue` to run all steps while you stay in the pried process. Type `respawn` to leave it and start a new shell. `IEx.pry/0` starts a session without `dbg`.

`IEx.break!/4` sets a breakpoint on a module, function, and arity that you cannot edit:

```elixir
break! URI, :parse, 1          # stops once
break! URI, :parse, 1, 10      # stops 10 times
break! URI.parse/1             # Mod.fun/arity form
break! URI.parse("https" <> _, _)    # only when the first argument matches
```

<Diagram name="iex/pry" caption="Both routes end in a pry session. You leave it with continue or respawn." />

It loads a new version of the module in memory with line-by-line breakpoints. **If you recompile the module, you lose all breakpoints**. Unlike `dbg`, breakpoints carry no imports or aliases from the source. You can set only one breakpoint for each function, so a second call with another pattern keeps only the last breakpoint. The default is one stop. After all stops are used, the module stays "instrumented" until you call `remove_breaks/1` (one module) or `remove_breaks/0` (all modules). The helpers are `breaks/0`, `continue/0`, `n/0`, `next/0`, `open/0`, `reset_break/1`, `reset_break/3`, `respawn/0`, and `whereami/1`.

Macros are mostly expanded at compile time and receive ASTs, not values, so a breakpoint pattern such as `when pid == self()` on a macro is never reached. With tests, run `iex -S mix test --trace` so that timeouts do not stop you.

<UnderTheHood>

**In short:** `IEx.break!` replaces the module in memory with a modified copy. The file on disk does not change.

**What changes.** When we set a breakpoint on `URI.parse/1`, the MD5 checksum of the loaded module changed (we read it with `URI.module_info(:md5)`). `:code.is_loaded(URI)` kept pointing to the same `.beam` file, 54,764 bytes. After `remove_breaks`, the checksum was the original again, if we removed the breakpoint for the one module or for all of them. This agrees with the docs: the instrumented version lives in memory, and the module is normal again when the instrumentation is removed.

<Diagram name="iex/uth-break" caption="The running module changes. The file does not change." />

*Sources:* `module_info/1`, `:code.is_loaded/1`, and `:code.get_object_code/1` on Elixir 1.20.4 with Erlang/OTP 29. The test ran `IEx.break!/4` from a script after it started the `:iex` application. We did not run a pry session.

</UnderTheHood>

## The .iex.exs file

On start, IEx looks for a configured path, then a local `.iex.exs` in the working directory, then a global file in `IEX_HOME` (default `~`). It loads **the first file that it finds**. It evaluates the code line by line as if you typed it in the shell, so loaded modules and bound variables are available after boot.

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

<Diagram name="iex/dotiex" caption="IEx loads only the first file that it finds." />

Choose another file with `config :iex, dot_iex: "PATH"`, `IEx.configure(dot_iex: "PATH")`, or `--dot-iex`. For remote nodes, the location is relative to the user who started the application, not the user who connects.

## Configure the shell

`IEx.configure/1` (see `h IEx.configure/1`) takes options such as `:inspect`, `:colors`, `:width`, `:history_size`, `:default_prompt`, `:alive_prompt`, `:auto_reload`, `:dot_iex`, and `:parser`. Put it in a `.iex.exs`:

```elixir
IEx.configure(inspect: [limit: 3])
```

Now `[1, 2, 3, 4, 5]` prints as `[1, 2, 3, ...]`.

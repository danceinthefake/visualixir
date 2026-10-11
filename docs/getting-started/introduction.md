# Introduction

Source: [Elixir guide, Introduction](https://elixir.hexdocs.pm/introduction.html).

This guide covers the basics of Elixir: syntax, modules, and the common data structures. This chapter installs Elixir and starts IEx.

## Installation

Install Elixir from the [installation page](https://elixir-lang.org/install.html). Then make sure that the installation works with `elixir --version`. The version of the guide that this site mirrors needs **Elixir 1.18.0 or later** and **Erlang/OTP 27 or later**.

## The three executables

The Elixir installation gives you `iex`, `elixir`, and `elixirc`. All three end up on the Erlang VM.

<Diagram name="introduction/tools" caption="iex and elixir evaluate code directly. elixirc writes .beam bytecode that the VM loads." />

- **`iex`** is the interactive shell. Type an expression and get its result. To exit, press `Ctrl+C` twice. (On Windows PowerShell, use `iex.bat`.)
- **`elixir file.exs`** runs a script.
- **`elixirc`** compiles `.ex` files to bytecode.

```elixir
iex(1)> 40 + 2
42
iex(2)> "hello" <> " world"
"hello world"
```

<UnderTheHood>

**What starts when you type `elixir`.** `elixir` is a small shell script. It starts `erl`, which starts `erlexec`, which starts `beam.smp`. This is the Erlang VM, an ordinary Linux program. On this machine, the VM then runs as 48 OS threads.

**Where the code comes from.** The VM is a native program. The libraries of Elixir and Erlang are `.beam` files on disk, and the VM reads and loads each file that it needs. For a script that only prints one line, the VM opened 213 `.beam` files, loaded 209 modules, and held 12.6 MB of code in memory. `elixirc` does the reverse. It writes one `.beam` file for each module (a small module was 2,308 bytes).

<Diagram name="introduction/uth-startup" caption="From the elixir command to your script: a chain of launchers, then the VM reads .beam files." />

*Sources:* `elixir` starts with `#!/bin/sh`, and the kernel starts programs with `execve`. We used `strace -f -e trace=execve,openat` on Linux with Erlang/OTP 29 and Elixir 1.20. We used `:code.all_loaded/0` and `:erlang.memory(:code)` for the module and code counts. The counts depend on the version and on what the script uses.

</UnderTheHood>

## Running scripts

Put this code in `simple.exs`:

```elixir
IO.puts("Hello world from Elixir")
```

Then run `elixir simple.exs`. For the basics of the language, you need only `iex` and `elixir`. The Mix and OTP guide covers real projects.

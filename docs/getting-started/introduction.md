# Introduction

Source: [Elixir guide, Introduction](https://elixir.hexdocs.pm/introduction.html).

This guide covers Elixir fundamentals: syntax, modules, the common data structures. This chapter gets Elixir installed and IEx running.

## Installation

Install from the [installation page](https://elixir-lang.org/install.html) and check with `elixir --version`. The guide, in the version
mirrored here, needs **Elixir 1.18.0 or later** and **Erlang/OTP 27 or later**.

## The three executables

Installing Elixir gives you `iex`, `elixir` and `elixirc`. All of them end up on the Erlang VM.

<Diagram name="introduction/tools" caption="iex and elixir evaluate code directly. elixirc writes .beam bytecode for the VM to load." />

- **`iex`** is the interactive shell. Type an expression, get its result. Exit with `Ctrl+C` twice. (`iex.bat` on Windows PowerShell.)
- **`elixir file.exs`** runs a script.
- **`elixirc`** compiles `.ex` files to bytecode.

```elixir
iex(1)> 40 + 2
42
iex(2)> "hello" <> " world"
"hello world"
```

<UnderTheHood>

**What starts when you type `elixir`.** `elixir` is a small shell script. It starts `erl`, which starts `erlexec`, which starts `beam.smp`: the Erlang VM, an ordinary Linux program. On this machine the VM then runs as 48 OS threads.

**Where the code comes from.** The VM itself is a native program, but Elixir and Erlang's libraries are `.beam` files on disk, and the VM reads and loads each one it needs. For a script that only prints one line, it opened 213 `.beam` files, loaded 209 modules and held 12.6 MB of code in memory. `elixirc` does the reverse: it writes one `.beam` file per module (a small module was 2,308 bytes).

<Diagram name="introduction/uth-startup" caption="From the elixir command to your script: a launcher chain, then the VM reading .beam files." />

*Sources:* `elixir` starts with `#!/bin/sh`, and the kernel starts programs with `execve`. `strace -f -e trace=execve,openat` on Linux with Erlang/OTP 29 and Elixir 1.20; `:code.all_loaded/0` and `:erlang.memory(:code)` for the module and code counts. The counts depend on the version and on what the script uses.

</UnderTheHood>

## Running scripts

Put this in `simple.exs`:

```elixir
IO.puts("Hello world from Elixir")
```

and run `elixir simple.exs`. `iex` and `elixir` are all you need for the language basics. Real projects are covered in the Mix and OTP guide.

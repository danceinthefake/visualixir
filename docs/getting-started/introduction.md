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

## Running scripts

Put this in `simple.exs`:

```elixir
IO.puts("Hello world from Elixir")
```

and run `elixir simple.exs`. `iex` and `elixir` are all you need for the language basics. Real projects are covered in the Mix and OTP guide.

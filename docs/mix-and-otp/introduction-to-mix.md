# Introduction to Mix

Source: [Elixir guide, Introduction to Mix](https://elixir.hexdocs.pm/introduction-to-mix.html).

This guide builds a complete application: a distributed key-value store. Key-value pairs live in **buckets**, and the buckets are spread across nodes. A client can connect to any node. The client sends `CREATE shopping`, `PUT shopping milk 1`, `GET shopping milk`, or `DELETE shopping eggs`. The guide needs Elixir 1.18.0+ and Erlang/OTP 27+.

Three tools do the work:

- **OTP** is the set of libraries in Erlang for fault-tolerant applications, for example supervision trees and event managers.
- **Mix** is the build tool. It creates and compiles projects, runs tests, and manages dependencies.
- **ExUnit** is the test framework.

You do not need this guide to use Elixir. Frameworks such as Phoenix, Ecto, Nerves, Nx, Membrane, and Broadway hide these details. This guide shows the foundations that the frameworks use.

## Our first project

```console
$ mix new kv --module KV
```

`--module KV` overrides the default module name `Kv`.

<Diagram name="introduction-to-mix/project-layout" caption="What mix new generates. _build appears after the first compile." />

`mix.exs` holds the configuration of the project. It has two public functions and one private function:

- `project/0` returns configuration such as `app: :kv`, `version`, and `deps`.
- `application/0` supplies data for the generated application file (`extra_applications: [:logger]`).
- `deps/0` lists the dependencies.

`mix compile` builds into `_build`. `iex -S mix` opens a shell with the project loaded. After you edit the code, `recompile()` in the shell rebuilds the project. It returns `:ok` if it compiled something and `:noop` if it did not.

<Diagram name="introduction-to-mix/workflow" caption="The everyday loop." />

<UnderTheHood>

**In short:** compiling turns your source into files on disk, and Mix remembers what it compiled.

**What `mix compile` writes.** When we compiled a new `kv` project, Mix created these files under `_build/dev/lib/kv`:

- the compiled module (`Elixir.KV.beam`, 1,592 bytes)
- a small description of the application (`kv.app`, 164 bytes)
- the seven protocols in their consolidated form (from the Protocols chapter)
- bookkeeping files in `.mix/`

When we ran `mix compile` again, Mix wrote no `.beam` file. Mix keeps a record of what it compiled, so it saw that nothing changed. For this reason a second compile prints nothing, and `recompile()` can return `:noop`.

<Diagram name="introduction-to-mix/uth-build" caption="Compiling turns source into .beam files on disk. A manifest lets Mix skip work." />

*Sources:* `strace -f -y -e trace=openat` on `mix compile` with Elixir 1.20 / OTP 29, and `ls` of `_build`. A `.beam` file starts with the bytes `FOR1`, the tag of its container format. The file sizes depend on the code and the Elixir version.

</UnderTheHood>

## Running tests

By convention, every file in `lib/` has a `<name>_test.exs` file in `test/`. Test files are scripts (`.exs`), so Mix does not compile them first.

```elixir
defmodule KVTest do
  use ExUnit.Case
  doctest KV

  test "greets the world" do
    assert KV.hello() == :world
  end
end
```

`test/test_helper.exs` runs `ExUnit.start()` before every run. A failure prints the test name, its location, the failed code, and the left and right sides of `==`. To run one test, copy the location: `mix test test/kv_test.exs:5`. Tests run in random order.

## Formatting

`mix format` formats the code as `.formatter.exs` says. Editors can run it on save. On CI, run `mix format --check-formatted`.

## Environments

An environment changes the compilation for one scenario. Mix has three environments by default:

<Diagram name="introduction-to-mix/environments" caption="dev is the default, test is for mix test, and prod is for production." />

`MIX_ENV=prod mix compile` switches the environment. `Mix.env/0` returns the environment as an atom. `start_permanent: Mix.env() == :prod` makes the VM crash if the supervision tree of the application shuts down. You want this in production. You do not want it in dev or test, because a live VM helps you find the cause of a problem.

Mix is a build tool and is not available in production. Call `Mix.env/0` only in `mix.exs` and configuration files. Never call it in `lib/`. `mix help` and `mix help compile` list the tasks.

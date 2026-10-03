# Introduction to Mix

Source: [Elixir guide, Introduction to Mix](https://elixir.hexdocs.pm/introduction-to-mix.html).

This guide builds a complete application: a distributed key-value store. Key-value pairs live in **buckets**, and buckets are spread across nodes. A
client can connect to any node and send `CREATE shopping`, `PUT shopping milk 1`, `GET shopping milk` or `DELETE shopping eggs`. The
guide needs Elixir 1.18.0+ and Erlang/OTP 27+.

Three tools do the work:

- **OTP** is the set of libraries shipped with Erlang for robust, fault-tolerant applications: supervision trees, event managers and more.
- **Mix** is the build tool: create, compile, test, manage dependencies.
- **ExUnit** is the test framework.

You don't have to read this guide to use Elixir. Frameworks such as Phoenix, Ecto, Nerves, Nx, Membrane and Broadway hide these details. This guide
tours the foundations they are built on.

## Our first project

```console
$ mix new kv --module KV
```

`--module KV` overrides the default module name `Kv`.

<Diagram name="introduction-to-mix/project-layout" caption="What mix new generates. _build appears after the first compile." />

`mix.exs` configures the project. It has two public functions and a private one:

- `project/0` returns settings such as `app: :kv`, `version` and `deps`.
- `application/0` feeds the generated application file (`extra_applications: [:logger]`).
- `deps/0` lists dependencies.

`mix compile` builds into `_build`. `iex -S mix` opens a shell with the project loaded, and `recompile()` inside it rebuilds after edits
(`:ok` if something compiled, `:noop` if not).

<Diagram name="introduction-to-mix/workflow" caption="The everyday loop." />

<UnderTheHood>

**In short:** compiling turns your source into files on disk, and Mix remembers what it has already compiled.

**What `mix compile` writes.** Compiling a new `kv` project created files under `_build/dev/lib/kv`: the compiled module (`Elixir.KV.beam`, 1,592 bytes), a small description of the application (`kv.app`, 164 bytes), the seven protocols in their consolidated form (from the Protocols chapter), and bookkeeping files in `.mix/`. Running `mix compile` again wrote no `.beam` file, because Mix keeps a record of what it compiled and sees that nothing changed. That is why a second compile prints nothing and `recompile()` can answer `:noop`.

<Diagram name="introduction-to-mix/uth-build" caption="Compiling turns source into .beam files on disk. A manifest lets Mix skip work." />

*Sources:* `strace -f -y -e trace=openat` on `mix compile` with Elixir 1.20 / OTP 29, and `ls` of `_build`. A `.beam` file starts with the bytes `FOR1`, the tag of its container format. File sizes depend on the code and the Elixir version.

</UnderTheHood>

## Running tests

By convention every file in `lib/` has a `<name>_test.exs` in `test/`. Test files are scripts (`.exs`), so they aren't compiled first.

```elixir
defmodule KVTest do
  use ExUnit.Case
  doctest KV

  test "greets the world" do
    assert KV.hello() == :world
  end
end
```

`test/test_helper.exs` runs `ExUnit.start()` before every run. Failures print the test name, its location, the failed code and the left and right
sides of `==`. Copy the location to run one test: `mix test test/kv_test.exs:5`. Tests run in random order.

## Formatting

`mix format` formats the code according to `.formatter.exs`. Editors can run it on save. On CI, run `mix format --check-formatted`.

## Environments

An environment customizes compilation for a scenario. There are three by default:

<Diagram name="introduction-to-mix/environments" caption="dev by default, test for mix test, prod for production." />

`MIX_ENV=prod mix compile` switches the environment. `Mix.env/0` returns it as an atom. `start_permanent: Mix.env() == :prod` makes
the VM crash if the application's supervision tree shuts down, which you want in production but not in dev or test, where a live VM
helps you troubleshoot.

Mix is a build tool and isn't available in production. Only call `Mix.env/0` in `mix.exs` and config files, never in `lib/`.
`mix help` and `mix help compile` list tasks.

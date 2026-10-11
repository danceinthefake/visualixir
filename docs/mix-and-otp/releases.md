# Releases

Source: [Elixir guide, Releases](https://elixir.hexdocs.pm/releases.html).

Everything so far depends on the Erlang and Elixir that are installed on your machine. A **release** is a self-contained directory. It holds your code, its dependencies, and the whole Erlang VM and runtime. It runs on any target with the **same OS distribution and version** as the machine that built it.

```console
$ MIX_ENV=prod mix release
Release created at _build/prod/rel/kv
```

<Diagram name="releases/contents" caption="Copy one directory. The server does not need Erlang or Elixir." />

`bin/kv` is the entry point. These are its commands:

| Command | Action |
|---|---|
| `start`, `start_iex`, `restart`, `stop` | manage the release |
| `rpc COMMAND`, `remote` | run a command in the running system, or connect to it |
| `eval COMMAND` | start a new system, run one command, and shut down |
| `daemon`, `daemon_iex` | run as a daemon on Unix-like systems |
| `install` | install as a service on Windows |

## Why use releases?

- **Code preloading.** By default, the VM loads a module the first time that code uses it (*interactive* mode). The first requests in production can then be slow. Releases run in *embedded* mode and load all modules at boot.
- **Configuration and customization.** You have fine control over the system configuration and the VM flags.
- **Self-contained.** The server needs no source code and no Erlang or Elixir. The release keeps only the parts of the standard libraries that you use.
- **Multiple releases.** You can assemble different releases with different configuration, or with different applications.

<Diagram name="releases/code-loading" caption="A release pays the loading cost at boot and not on the first requests." />

<UnderTheHood>

**What embedded mode changes.** We built a small release and started it in each mode as a daemon. In the default *embedded* mode, the VM loaded 614 modules at boot, and `Stream` was in memory before any code called it. In *interactive* mode, the VM loaded only 159 modules, and `Stream` was not loaded. The first call to it reads `Elixir.Stream.beam` from disk, as in the Modules chapter. This read is the delay that the chapter describes. Embedded mode moves it to boot time.

**What is in the directory.** The release was 21 MB. The VM runtime (`erts`) used 11 MB, and `beam.smp` alone is 10.1 MB. The libraries used 9.4 MB, with 599 `.beam` files. For this reason the release runs on a machine that does not have Erlang or Elixir.

<Diagram name="releases/uth-modes" caption="Embedded mode loads the modules at boot. Interactive mode loads each module on first use." />

*Sources:* we measured with `bin/kv daemon`, `bin/kv rpc`, `:code.all_loaded/0`, and `du`, on Elixir 1.20 / OTP 29. The counts depend on the application.

</UnderTheHood>

## Configuration of releases

<Diagram name="releases/hooks" caption="One hook at build time and three at boot." />

- `config/config.exs`: build-time configuration. It runs before the application compiles. It often imports `dev.exs` or `prod.exs`.
- `config/runtime.exs`: runs on every boot. Configuration providers can extend it.
- `rel/env.sh.eex`, `rel/env.bat.eex`: templates that run on every command. They set the OS and VM environment variables.
- `rel/vm.args.eex`: fixed Erlang VM flags.

Our `runtime.exs` already handles `PORT` and `NODES`. Releases do not take `--sname`, but `RELEASE_NODE` sets the name. Start two copies in this way:

```console
$ NODES="foo@computer-name,bar@computer-name" PORT=4040 RELEASE_NODE="foo" bin/kv start_iex
$ NODES="foo@computer-name,bar@computer-name" PORT=4041 RELEASE_NODE="bar" bin/kv start_iex
```

To make sure that the nodes are connected, run `Node.list` in either shell.

## OS scripts and VM arguments

Releases use short names (`--sname`) by default. For real distribution, set `RELEASE_DISTRIBUTION` to `name` in `env.sh` (or `env.bat` on Windows). `mix release.init` copies the templates into `rel/`:

```shell
# export RELEASE_MODE=interactive     # load code on demand instead of preloading
# export RELEASE_DISTRIBUTION=name    # "sname" (local), "name" (distributed) or "none"
# export RELEASE_NODE=<%= @release.name %>
```

`rel/vm.args.eex` holds low-level VM flags. For example, `+Q 65536` allows more concurrent ports and sockets, and `-env ERL_FULLSWEEP_AFTER 10` makes the garbage collector run more often. Do not set `-name`, `-sname`, or `-setcookie` there. Use environment variables.

## Summing up

We built a distributed key-value store. We learned about GenServers, supervisors, tasks, agents, and applications, wrote tests with ExUnit, and used Mix throughout. For a real distributed key-value store, look at Riak. It also runs on the Erlang VM and copies buckets across nodes.

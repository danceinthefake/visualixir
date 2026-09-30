# Releases

Source: [Elixir guide, Releases](https://elixir.hexdocs.pm/releases.html).

Everything so far depends on the Erlang and Elixir installed on your machine. A **release** is a self-contained directory with your code, its dependencies, and the whole
Erlang VM and runtime. It runs on any target with the **same OS distribution and version** as the machine that built it.

```console
$ MIX_ENV=prod mix release
Release created at _build/prod/rel/kv
```

<Diagram name="releases/contents" caption="Copy one directory. The server needs no Erlang or Elixir." />

`bin/kv` is the entry point:

| Command | Does |
|---|---|
| `start`, `start_iex`, `restart`, `stop` | manage the release |
| `rpc COMMAND`, `remote` | run a command in, or connect to, the running system |
| `eval COMMAND` | start a fresh system, run one command, shut down |
| `daemon`, `daemon_iex` | run as a daemon on Unix-like systems |
| `install` | install as a service on Windows |

## Why releases?

- **Code preloading.** By default the VM loads modules the first time they are used (*interactive* mode), so the first requests in production can spike. Releases run in *embedded*
  mode and load everything at boot.
- **Configuration and customization.** Fine control over system configuration and VM flags.
- **Self-contained.** No source code and no Erlang or Elixir on the server. The standard libraries are stripped to the parts you use.
- **Multiple releases.** Assemble different releases with different configuration, or with different applications.

<Diagram name="releases/code-loading" caption="A release pays the loading cost at boot instead of on the first requests." />

## Configuring releases

<Diagram name="releases/hooks" caption="One hook at build time, three at boot." />

- `config/config.exs`: build-time configuration, run before the app compiles. It often imports `dev.exs` or `prod.exs`.
- `config/runtime.exs`: runs on every boot, and can be extended with config providers.
- `rel/env.sh.eex`, `rel/env.bat.eex`: templates executed on every command to set OS and VM environment variables.
- `rel/vm.args.eex`: static Erlang VM flags.

Our `runtime.exs` already handles `PORT` and `NODES`. Releases don't take `--sname`, but `RELEASE_NODE` sets the name, so two copies run like this:

```console
$ NODES="foo@computer-name,bar@computer-name" PORT=4040 RELEASE_NODE="foo" bin/kv start_iex
$ NODES="foo@computer-name,bar@computer-name" PORT=4041 RELEASE_NODE="bar" bin/kv start_iex
```

Check with `Node.list` in either shell.

## OS scripts and VM arguments

Releases use short names (`--sname`) by default. For real distribution, set `RELEASE_DISTRIBUTION` to `name` in `env.sh` (or `env.bat` on Windows). `mix release.init` copies the templates
into `rel/`:

```shell
# export RELEASE_MODE=interactive     # load code on demand instead of preloading
# export RELEASE_DISTRIBUTION=name    # "sname" (local), "name" (distributed) or "none"
# export RELEASE_NODE=<%= @release.name %>
```

`rel/vm.args.eex` holds low-level VM flags, such as `+Q 65536` for more concurrent ports/sockets or `-env ERL_FULLSWEEP_AFTER 10` for more frequent GC. Don't set `-name`, `-sname` or
`-setcookie` there. Use environment variables.

## Summing up

We built a distributed key-value store and met GenServers, supervisors, tasks, agents and applications, wrote tests with ExUnit, and used Mix throughout. For a real distributed
key-value store, look at Riak, which also runs on the Erlang VM and replicates buckets across nodes.

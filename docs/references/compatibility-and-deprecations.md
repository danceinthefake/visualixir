# Compatibility and deprecations

Source: [Elixir reference, Compatibility and deprecations](https://elixir.hexdocs.pm/compatibility-and-deprecations.html).

Elixir uses `vMAJOR.MINOR.PATCH`. It is at major version 1. A backwards-compatible **minor** release comes every 6 months. **Patch** releases have no schedule. They are for bug fixes or security patches. There are no plans for a major v2.

Bug fixes go only to the latest minor branch. Security patches cover the last 5 minor branches:

| Elixir | Support |
|---|---|
| 1.20 | Bug fixes and security patches |
| 1.19 | Security patches only |
| 1.18 | Security patches only |
| 1.17 | Security patches only |
| 1.16 | Security patches only |

The read-only mailing list elixir-lang-ann announces releases. Security releases have the tag `[security]`.

## Between non-major Elixir versions

Minor and patch releases are backwards compatible: documented and well-defined behavior keeps working. Some rare changes can still break code:

- **Security:** a fix can require an incompatible change.
- **Bugs:** a program that relies on buggy behavior can break when the bug is fixed.
- **Compiler front-end:** new warnings and clearer errors can fail builds that run with `--warnings-as-errors`, or tools that assert on exact messages.
- **Imports:** Elixir imports new `Kernel` functions automatically, and they can collide with your local functions. To fix this, use `import Kernel, except: [...]`.

Experimental features have an explicit mark and carry no guarantee until they are stable.

## Between Elixir and Erlang/OTP

Erlang/OTP has its own versions, with a new major version every year. The goal is to support the last three Erlang major versions when Elixir is released.

| Elixir | Erlang/OTP |
|---|---|
| 1.20 | 27 - 29 |
| 1.19 | 26 - 28 |
| 1.18 | 25 - 27 |
| 1.17 | 25 - 27 |
| 1.16 | 24 - 26 |
| 1.15 | 24 - 26 |
| 1.14 | 23 - 25 (and 26 from v1.14.5) |
| 1.13 | 22 - 24 (and 25 from v1.13.4) |
| 1.12 | 22 - 24 |
| 1.11 | 21 - 23 (and 24 from v1.11.4) |
| 1.10 | 21 - 22 (and 23 from v1.10.3) |
| 1.9, 1.8 | 20 - 22 |
| 1.7 | 19 - 22 |
| 1.6 | 19 - 20 (and 21 from v1.6.6) |
| 1.5 | 18 - 20 |
| 1.4 | 18 - 19 (and 20 from v1.4.5) |
| 1.3 | 18 - 19 |
| 1.2 | 18 - 18 (and 19 from v1.2.6) |
| 1.1 | 17 - 18 |
| 1.0 | 17 - 17 (and 18 from v1.0.5) |

Patch releases can add support for a new OTP version (Erlang/OTP 20 in v1.4.5). They usually make the minimum change necessary to run. Only the next minor version (v1.5.0) uses the new OTP features.

## Deprecations

<Diagram name="compatibility-and-deprecations/deprecation-steps" caption="Nothing is removed until a major release." />

1. **Soft-deprecated:** the CHANGELOG and the docs list the feature as deprecated, but Elixir emits no warning. This step is optional.
2. **Hard-deprecated:** the feature gives a warning when you use it. The proposed replacement **must exist for at least three minor versions** first. `Enum.uniq/2` was soft-deprecated for `Enum.uniq_by/2` in v1.1, so a warning can come in v1.4 or later.
3. **Removed:** only in a major release, so only v2.x can remove v1.x deprecations.

### Recent deprecations

The first column is the version where Elixir hard-deprecated the feature. The full table, back to v1.1, is at [elixir.hexdocs.pm/compatibility-and-deprecations](https://elixir.hexdocs.pm/compatibility-and-deprecations.html#table-of-deprecations).

| Version | Deprecated | Replaced by (available since) |
|---|---|---|
| v1.20 | `<<x::size(y)>>` in patterns without `^` | `<<x::size(^y)>>` (v1.15) |
| v1.20 | `File.stream!(path, modes, lines_or_bytes)` | `File.stream!(path, lines_or_bytes, modes)` (v1.16) |
| v1.20 | `Kernel.ParallelCompiler.async/1` | `Kernel.ParallelCompiler.pmap/2` (v1.16) |
| v1.20 | `Logger.*_backend` functions | `LoggerBackends` from the `:logger_backends` package |
| v1.20 | `Logger.enable/1`, `Logger.disable/1` | `Logger.put_process_level/2`, `Logger.delete_process_level/1` (v1.15) |
| v1.19 | CLI configuration in `def project` | move it to `def cli` (v1.14) |
| v1.19 | `,` to separate tasks in `mix do` | `+` (v1.14) |
| v1.19 | `Logger`'s `:backends` configuration | `:default_handler` configuration (v1.15) |
| v1.19 | callbacks to `File.cp/3`, `cp!/3`, `cp_r/3`, `cp_r!/3` | the `:on_conflict` option (v1.14) |
| v1.18 | `<%#` in EEx | `<%!--` (v1.14) or `<% #` (v1.0) |
| v1.18 | `EEx.Engine.handle_text/2` | `handle_text/3` (v1.14) |
| v1.18 | returning a 2-arity function from `Enumerable.slice/1` | a 3-arity function (v1.14) |
| v1.18 | ranges with negative steps in `Range.new/2` | explicit steps in ranges (v1.11) |
| v1.18 | `Tuple.append/2` | `Tuple.insert_at/3` (v1.0) |
| v1.18 | `mix cmd --app APP` | `mix do --app APP` (v1.14) |
| v1.18 | `List.zip/1` | `Enum.zip/1` (v1.0) |
| v1.18 | `Module.eval_quoted/3` | `Code.eval_quoted/3` (v1.0) |
| v1.17 | single-quoted charlists (`'foo'`) | `~c"foo"` (v1.0) |
| v1.17 | `left..right` in patterns and guards | `left..right//step` (v1.11) |
| v1.17 | `ExUnit.Case.register_test/4` | `register_test/6` (v1.10) |
| v1.17 | `:all` in `IO.read/2` and `IO.binread/2` | `:eof` (v1.13) |

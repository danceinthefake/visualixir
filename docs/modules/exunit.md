---
source: https://hexdocs.pm/ex_unit/ExUnit.html
---

# ExUnit

Source: [Elixir docs, ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html), [ExUnit.Case](https://hexdocs.pm/ex_unit/ExUnit.Case.html) and [ExUnit.Callbacks](https://hexdocs.pm/ex_unit/ExUnit.Callbacks.html).

ExUnit is Elixir's unit testing framework. A basic test file:

```elixir
# File: assertion_test.exs
ExUnit.start()

defmodule AssertionTest do
  use ExUnit.Case, async: true

  test "the truth" do
    assert true
  end
end
```

Run it with `elixir assertion_test.exs`. In a Mix project, `mix test` runs every file matching `*_test.exs` in `test/`. Mix loads `test/test_helper.exs` first, which at minimum holds `ExUnit.start()`.
`use ExUnit.Case` imports `ExUnit.Assertions`, `ExUnit.Callbacks`, `ExUnit.DocTest` and `ExUnit.Case` itself.

## What runs at the same time

`async: true` lets the tests in this module run **concurrently with tests in other modules**. Tests in the same module never run concurrently, and async should be on only if the tests change no global state.
`:max_cases` caps how many run in parallel, by default `System.schedulers_online * 2`. Only tests from different modules run in parallel.

<Diagram name="exunit/async" caption="Modules overlap. Tests inside one module don't." />

Two more options on `use ExUnit.Case`: `:group` (since v1.18.0) keeps modules in the same group from ever running concurrently, even with `async: true`, and `:parameterize` (since v1.18.0) takes a list of maps and runs the tests once per map, merged into the context.
Parameterized tests run concurrently if `async: true` is also given, but abuse can slow the suite, and if you add conditionals for different parameters, plain tests that share regular functions fit better.

## A test's life: setup, test, on_exit

`setup_all` callbacks run **once per module**, before any test. `setup` callbacks run **before each test**. Neither runs if the module has no tests or all are filtered out. Both can be a block, an atom naming a local function,
a `{module, function}` tuple, or a list of those, and run in order of appearance. They can return `:ok`, a keyword list or map, or `{:ok, keyword_or_map}`. What they return is merged into the **context**, which every later callback and the test receives.
Anything else from `setup_all` makes all tests fail. A bad return from `setup` fails that test.

<Diagram steps name="exunit/lifecycle" caption="The life cycle of one test process." />

`start_supervised/2` starts a process under a supervisor linked to the test process. The supervisor and its children are guaranteed to terminate before any `on_exit/2` callback runs. The started process is not linked to the test,
so a crash does not necessarily fail it. Use `start_link_supervised!/2` for a crash that must fail the test. `on_exit/2` registers a callback, often to undo what a setup did. A registered `on_exit/2` callback always runs,
while a failure in `setup` or `setup_all` stops the rest of the setup callbacks.

The test process always exits with reason `:shutdown`, so linked processes exit too, but asynchronously. That is why `start_supervised/2` is preferred: it guarantees supervised processes are fully gone before the next test starts.

<UnderTheHood>

**In short:** every test is its own Erlang process, and ExUnit uses other processes for `setup_all` and `on_exit`.

**Which process runs what.** A small test module with `setup_all`, `setup`, two tests and an `on_exit` callback, run with `ExUnit.run/0` on Elixir 1.20.4, recorded `self()` at each point. `setup_all` ran in one process. The `setup` callback and the test ran in the **same** process, which was also `ctx.test_pid`. The second test ran in a **different** process. The `on_exit` callback ran in a third process, different from the test's. A process started with `Agent.start_link` in `setup` was linked to the test process before the test body ran. This matches the process architecture in the `ExUnit.Case` docs.

**What overlaps.** Two async modules, one with two tests that each slept 300 ms and one with a single such test, finished the whole run in **613 ms**. The test in the second module started in the same millisecond as the first test of the first module, and the second test of the first module began only after that first one finished. So 3 tests of 300 ms took about the time of 2. `:max_cases` read 32 here, which is `System.schedulers_online * 2` with 16 schedulers online.

<Diagram name="exunit/uth-processes" caption="Process boundaries observed in a run." />

*Sources:* `self/0`, `Process.info/2` and `ExUnit.run/0` on Elixir 1.20.4 with Erlang/OTP 29 on a 16-thread AMD Ryzen 7 5700G. The 613 ms is one run, and timings drift by machine.

</UnderTheHood>

`on_exit/2` callbacks always run in a separate process. Called inside `setup/1` or a test, they run after the test exits and *before the next test*, so no other test of the same module runs while they do. They run in the reverse order they were defined.

## Tags and filters

The context carries information **to** the test. **Tags** carry it from the test to the callbacks:

```elixir
setup context do
  if cd = context[:cd] do
    prev_cd = File.cwd!()
    File.cd!(cd)
    on_exit(fn -> File.cd!(prev_cd) end)
  end

  :ok
end

@tag cd: "fixtures"
test "reads UTF-8 fixtures" do
  File.read("README.md")
end
```

`@tag :key` is the same as `@tag key: true`, and the last value wins. `@moduletag` and `@describetag` cover a whole module or `describe` block. They must come after `use ExUnit.Case`. A `@tag` value beats a `@moduletag`
for the same key. `setup_all` only receives `@moduletag` tags.

<Diagram name="exunit/tags" caption="Tags enter the context. Callbacks can read them and add more." />

ExUnit sets some tags itself, so they are reserved: `:async`, `:file`, `:line`, `:module`, `:registered`, `:test`, `:test_group`, `:test_pid`, `:test_type`, and for describe or doctest tests `:describe`, `:describe_line`, `:doctest`, `:doctest_data` and `:doctest_line`.
These tags change behaviour: `:capture_log`, `:skip` (with a reason), `:timeout` (default `60_000`, or `:infinity`) and `:tmp_dir`.

**Filters** use tags to pick tests. Exclude in config and include from the command line:

```elixir
ExUnit.configure(exclude: [external: true])
```

```
$ mix test --include external:true
```

All tests are included by default, so `:include` has no effect unless they were excluded first. To run only a subset, exclude a tag first, then include the part you want: `ExUnit.configure(exclude: :os, include: [os: :unix])`.

## Log capture and temporary directories

With `@tag :capture_log` (or `ExUnit.start(capture_log: true)`), log messages during a test are captured and printed only if the test fails. `capture_log: false` on a tag or `@moduletag` overrides the default.
Logs from `setup_all` or between tests are never captured.

A test tagged `:tmp_dir` gets a unique directory in its context, removed before it is created, and its path contains the module and test name, so it is safe for concurrent tests. `tmp_dir: "my_path"` makes the path `tmp/<module>/<test>/my_path`.

## Configuration

`ExUnit.configure/1` (or `ExUnit.start/1`) takes these notable options:

| Option | Default | Meaning |
|---|---|---|
| `:timeout` | `60_000` | per-test timeout in ms |
| `:max_cases` | `System.schedulers_online * 2` | tests run in parallel |
| `:seed` | not stated | `0` disables randomization, and tests in each file run in definition order |
| `:max_failures` | `:infinity` | stop the suite after this many failures |
| `:refute_receive_timeout` | `100` | for `refute_receive` |
| `:stacktrace_depth` | `20` | depth in formatters and reports |
| `:trace` | `false` | print each test, set `:max_cases` to `1` and ignore timeouts |
| `:slowest`, `:slowest_modules` | off | time the N slowest tests or modules (this implies trace mode) |

The seed is mixed with the module and test name to make a new unique seed per test, fed to `:rand`, so a run is random but reproducible.
A test ends in one of five states: passed, failed, skipped (`@tag :skip`), excluded (`:exclude` filters) or invalid (when `setup_all` fails).

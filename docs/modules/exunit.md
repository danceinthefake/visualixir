---
source: https://hexdocs.pm/ex_unit/ExUnit.html
---

# ExUnit

Source: [Elixir docs, ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html), [ExUnit.Case](https://hexdocs.pm/ex_unit/ExUnit.Case.html) and [ExUnit.Callbacks](https://hexdocs.pm/ex_unit/ExUnit.Callbacks.html).

ExUnit is the unit testing framework of Elixir. This is a basic test file:

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

Run it with `elixir assertion_test.exs`. In a Mix project, `mix test` runs every file that matches `*_test.exs` in `test/`. Mix loads `test/test_helper.exs` first, which holds at least `ExUnit.start()`. `use ExUnit.Case` imports `ExUnit.Assertions`, `ExUnit.Callbacks`, `ExUnit.DocTest`, and `ExUnit.Case` itself.

## What runs at the same time

`async: true` lets the tests in this module run **concurrently with tests in other modules**. Tests in the same module never run concurrently. Use async only if the tests do not change global state. `:max_cases` limits how many tests run in parallel, by default `System.schedulers_online * 2`. Only tests from different modules run in parallel.

<Diagram name="exunit/async" caption="Modules overlap. Tests inside one module do not." />

There are two more options on `use ExUnit.Case`. `:group` (since v1.18.0) makes sure that modules in the same group never run concurrently, even with `async: true`. `:parameterize` (since v1.18.0) takes a list of maps and runs the tests once for each map, merged into the context. Parameterized tests run concurrently if you also give `async: true`. But abuse can slow the suite. If you add conditionals for different parameters, plain tests that share regular functions are better.

## The life of a test: setup, test, on_exit

`setup_all` callbacks run **once for each module**, before any test. `setup` callbacks run **before each test**. Neither runs if the module has no tests or if the filters remove all tests. Both can be a block, an atom that names a local function, a `{module, function}` tuple, or a list of these. They run in the order of appearance. They can return `:ok`, a keyword list or map, or `{:ok, keyword_or_map}`. The system merges what they return into the **context**, which every later callback and the test receives. Any other return value from `setup_all` makes all tests fail. A bad return value from `setup` fails that test.

<Diagram steps name="exunit/lifecycle" caption="The life cycle of one test process." />

`start_supervised/2` starts a process under a supervisor that is linked to the test process. The supervisor and its children terminate before any `on_exit/2` callback runs. The started process is not linked to the test, so a crash does not necessarily fail the test. Use `start_link_supervised!/2` for a crash that must fail the test. `on_exit/2` registers a callback, often to undo what a setup did. A registered `on_exit/2` callback always runs, but a failure in `setup` or `setup_all` stops the remaining setup callbacks.

The test process always exits with reason `:shutdown`, so linked processes exit too, but asynchronously. For this reason, `start_supervised/2` is preferred: it makes sure that supervised processes are fully gone before the next test starts.

<UnderTheHood>

**In short:** every test is its own Erlang process, and ExUnit uses other processes for `setup_all` and `on_exit`.

**Which process runs what.** We ran a small test module with `setup_all`, `setup`, two tests, and an `on_exit` callback with `ExUnit.run/0` on Elixir 1.20.4. We recorded `self()` at each point. `setup_all` ran in one process. The `setup` callback and the test ran in the **same** process, which was also `ctx.test_pid`. The second test ran in a **different** process. The `on_exit` callback ran in a third process, different from the test process. A process that started with `Agent.start_link` in `setup` was linked to the test process before the test body ran. This agrees with the process architecture in the `ExUnit.Case` docs.

**What overlaps.** We used two async modules: one with two tests that each slept 300 ms, and one with a single such test. The whole run took **613 ms**. The test in the second module started in the same millisecond as the first test of the first module. The second test of the first module began only after the first test finished. So 3 tests of 300 ms took about the time of 2 tests. `:max_cases` read 32 here, which is `System.schedulers_online * 2` with 16 schedulers online.

<Diagram name="exunit/uth-processes" caption="The process boundaries that we observed in a run." />

*Sources:* `self/0`, `Process.info/2`, and `ExUnit.run/0` on Elixir 1.20.4 with Erlang/OTP 29 on a 16-thread AMD Ryzen 7 5700G. The 613 ms is one run, and timings change from machine to machine.

</UnderTheHood>

`on_exit/2` callbacks always run in a separate process. If you call them inside `setup/1` or a test, they run after the test exits and *before the next test*. No other test of the same module runs while they run. They run in the reverse order of their definition.

## Tags and filters

The context carries information **to** the test. **Tags** carry information from the test to the callbacks:

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

`@tag :key` is the same as `@tag key: true`, and the last value wins. `@moduletag` and `@describetag` cover a whole module or `describe` block. They must come after `use ExUnit.Case`. A `@tag` value has priority over a `@moduletag` for the same key. `setup_all` receives only `@moduletag` tags.

<Diagram name="exunit/tags" caption="Tags enter the context. Callbacks can read them and add more tags." />

ExUnit sets some tags itself, so they are reserved: `:async`, `:file`, `:line`, `:module`, `:registered`, `:test`, `:test_group`, `:test_pid`, `:test_type`, and for describe or doctest tests `:describe`, `:describe_line`, `:doctest`, `:doctest_data`, and `:doctest_line`. These tags change behavior: `:capture_log`, `:skip` (with a reason), `:timeout` (default `60_000`, or `:infinity`), and `:tmp_dir`.

**Filters** use tags to pick tests. Exclude in the configuration and include from the command line:

```elixir
ExUnit.configure(exclude: [external: true])
```

```
$ mix test --include external:true
```

All tests are included by default, so `:include` has no effect unless an exclude filter removed them first. To run only a subset, first exclude a tag, and then include the part that you want: `ExUnit.configure(exclude: :os, include: [os: :unix])`.

## Log capture and temporary directories

With `@tag :capture_log` (or `ExUnit.start(capture_log: true)`), ExUnit captures the log messages during a test and prints them only if the test fails. `capture_log: false` on a tag or `@moduletag` overrides the default. ExUnit never captures logs from `setup_all` or between tests.

A test with the tag `:tmp_dir` gets a unique directory in its context. ExUnit removes the directory before it creates it, and its path contains the module and test name, so it is safe for concurrent tests. `tmp_dir: "my_path"` makes the path `tmp/<module>/<test>/my_path`.

## Configuration

`ExUnit.configure/1` (or `ExUnit.start/1`) takes these main options:

| Option | Default | Meaning |
|---|---|---|
| `:timeout` | `60_000` | the timeout for each test, in ms |
| `:max_cases` | `System.schedulers_online * 2` | the number of tests that run in parallel |
| `:seed` | not stated | `0` disables randomization, and the tests in each file run in the order of definition |
| `:max_failures` | `:infinity` | stop the suite after this number of failures |
| `:refute_receive_timeout` | `100` | for `refute_receive` |
| `:stacktrace_depth` | `20` | the depth in formatters and reports |
| `:trace` | `false` | print each test, set `:max_cases` to `1`, and ignore timeouts |
| `:slowest`, `:slowest_modules` | off | measure the time of the N slowest tests or modules (this implies trace mode) |

ExUnit mixes the seed with the module and test name to make a new unique seed for each test. It feeds the seed to `:rand`, so a run is random but repeatable. A test ends in one of five states: passed, failed, skipped (`@tag :skip`), excluded (`:exclude` filters), or invalid (when `setup_all` fails).

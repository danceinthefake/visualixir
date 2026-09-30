# Doctests, patterns, and with

Source: [Elixir guide, Doctests, patterns, and with](https://elixir.hexdocs.pm/docs-tests-and-with.html).

This chapter parses the commands (`CREATE`, `PUT`, `GET`, `DELETE`) and dispatches them to buckets.

## Doctests

Examples in documentation double as tests. A doctest is four spaces of indentation and `iex>` inside a doc string, with `...>` for continuation lines.
The expected result follows on the next line. Use `~S"""` so `\r\n` isn't interpreted until the test runs.

```elixir
defmodule KV.Command do
  @doc ~S"""
  Parses the given `line` into a command.

  ## Examples

      iex> KV.Command.parse("CREATE shopping\r\n")
      {:ok, {:create, "shopping"}}

  """
end
```

```elixir
defmodule KV.CommandTest do
  use ExUnit.Case, async: true
  doctest KV.Command
end
```

A blank line between examples makes **separate** tests. Without one they compile into a single test. Doctests are documentation first and tests second, not a replacement for
tests.

## Parsing with patterns

`String.split/1` splits on whitespace, so extra spaces don't matter. Then let function-body pattern matching pick the command, with no `if/else` on
the name or argument count:

```elixir
def parse(line) do
  case String.split(line) do
    ["CREATE", bucket] -> {:ok, {:create, bucket}}
    ["GET", bucket, key] -> {:ok, {:get, bucket, key}}
    ["PUT", bucket, key, value] -> {:ok, {:put, bucket, key, value}}
    ["DELETE", bucket, key] -> {:ok, {:delete, bucket, key}}
    _ -> {:error, :unknown_command}
  end
end
```

<Diagram name="docs-tests-and-with/parse" caption="The shape of the list picks the command. Anything else is an unknown command." />

## with

The server has to handle several failure shapes at once (a closed socket, an unknown command), and nested `case` gets ugly. `with` turns each `case`
into a step:

```elixir
defp serve(socket) do
  msg =
    with {:ok, data} <- read_line(socket),
         {:ok, command} <- KV.Command.parse(data),
         do: KV.Command.run(command, socket)

  write_line(socket, msg)
  serve(socket)
end
```

`with` matches the right side of each `<-` against its pattern. On a match it moves on. On a mismatch it stops and returns the **non-matching value**
as is. `write_line/2` then has one clause per outcome:

```elixir
defp write_line(_socket, :ok), do: :ok
defp write_line(socket, {:error, :unknown_command}), do: :gen_tcp.send(socket, "UNKNOWN COMMAND\r\n")
defp write_line(socket, {:error, :not_found}), do: :gen_tcp.send(socket, "NOT FOUND\r\n")
defp write_line(_socket, {:error, :closed}), do: exit(:shutdown)
defp write_line(socket, {:error, error}) do
  :gen_tcp.send(socket, "ERROR\r\n")
  exit(error)
end
```

<Diagram name="docs-tests-and-with/with-chain" caption="Success walks the chain. The first mismatch jumps straight to write_line." />

## Running commands

```elixir
def run({:create, bucket}, socket) do
  KV.create_bucket(bucket)
  :gen_tcp.send(socket, "OK\r\n")
  :ok
end

def run({:get, bucket, key}, socket) do
  lookup(bucket, fn pid ->
    value = KV.Bucket.get(pid, key)
    :gen_tcp.send(socket, "#{value}\r\nOK\r\n")
    :ok
  end)
end

defp lookup(bucket, callback) do
  if bucket = KV.lookup_bucket(bucket), do: callback.(bucket), else: {:error, :not_found}
end
```

`put` and `delete` follow the same shape. The body-less `def run(command, socket)` is a function head: here it documents the arguments.

<Diagram name="docs-tests-and-with/request-path" caption="One PUT, from the socket to the agent and back." />

## Integration tests

Mocks would move tests away from how the code really runs. Instead, use the real local registry and give **each test a unique name** (module plus test name). A `setup`
block runs per test, opens a client connection and builds that name. It gets the same test context as the tests:

```elixir
setup config do
  {:ok, socket} = :gen_tcp.connect(~c"localhost", 4040, [:binary, packet: :line, active: false])
  test_name = config.test |> Atom.to_string() |> String.replace(" ", "-")
  %{socket: socket, name: "#{config.module}-#{test_name}"}
end

test "server interaction", %{socket: socket, name: name} do
  assert send_and_recv(socket, "CREATE #{name}\r\n") == "OK\r\n"
  assert send_and_recv(socket, "PUT #{name} eggs 3\r\n") == "OK\r\n"
  assert send_and_recv(socket, "GET #{name} eggs\r\n") == "3\r\n"
end
```

Stop any running `iex -S mix` first: tests and development use the same port, 4040. The next chapter fixes that.

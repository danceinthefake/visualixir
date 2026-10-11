# Doctests, patterns, and with

Source: [Elixir guide, Doctests, patterns, and with](https://elixir.hexdocs.pm/docs-tests-and-with.html).

This chapter parses the commands (`CREATE`, `PUT`, `GET`, `DELETE`) and sends them to buckets.

## Doctests

Examples in documentation are also tests. A doctest is four spaces of indentation and `iex>` inside a doc string. Use `...>` for continuation lines. The expected result is on the next line. Use `~S"""` so that Elixir does not interpret `\r\n` until the test runs.

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

A blank line between examples makes **separate** tests. Without a blank line, the examples compile into one test. Doctests are documentation first and tests second. They do not replace tests.

## Parsing with patterns

`String.split/1` splits on whitespace, so extra spaces do not matter. Then pattern matching in the function body picks the command. You do not need `if/else` on the name or on the number of arguments:

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

<Diagram name="docs-tests-and-with/parse" caption="The shape of the list picks the command. Any other shape is an unknown command." />

## with

The server must handle several failures at once, for example a closed socket and an unknown command. Nested `case` expressions are hard to read. `with` turns each `case` into a step:

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

`with` matches the right side of each `<-` against its pattern. If the value matches, `with` goes to the next step. If the value does not match, `with` stops and returns the **non-matching value** unchanged. `write_line/2` then has one clause for each outcome:

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

<Diagram name="docs-tests-and-with/with-chain" caption="On success, the chain runs to the end. The first mismatch goes straight to write_line." />

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

`put` and `delete` have the same shape. The `def run(command, socket)` without a body is a function head. Here it documents the arguments.

<Diagram name="docs-tests-and-with/request-path" caption="One PUT, from the socket to the agent and back." />

## Integration tests

Mocks make the tests differ from the real code. Instead, use the real local registry and give **each test a unique name** (the module name plus the test name). A `setup` block runs for each test. It opens a client connection and builds the name. It gets the same test context as the tests:

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

First, stop any running `iex -S mix`. The tests and the development server use the same port, 4040. The next chapter fixes this.

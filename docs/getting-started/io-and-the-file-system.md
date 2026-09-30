# IO and the file system

Source: [Elixir guide, IO and the file system](https://elixir.hexdocs.pm/io-and-the-file-system.html).

## IO

`IO` reads and writes to standard input/output (`:stdio`), standard error (`:stderr`), files and other IO devices. The default is
stdin/stdout, and you pass a device to change that:

```elixir
IO.puts("hello world")
IO.gets("yes or no? ")            #=> "yes\n"
IO.puts(:stderr, "hello world")
```

## File

`File` opens files as IO devices. Files open in binary mode, so use `IO.binwrite/2` and `IO.binread/2`. Pass `:utf8` to read as UTF-8, and
`:append` instead of `:write` to keep existing content. **`:write` deletes what's already there.**

```elixir
{:ok, file} = File.open("path/to/file/hello", [:write])
IO.binwrite(file, "world")
File.close(file)
File.read("path/to/file/hello")   #=> {:ok, "world"}
```

`File` also has UNIX-style operations: `rm/1`, `mkdir/1`, `mkdir_p/1`, `cp_r/2`, `rm_rf/1`.

### `read` or `read!`

Functions come in two variants. The plain one returns `{:ok, _}` or `{:error, reason}`, and the `!` one returns the bare result or raises.

- Use the plain one when you handle both outcomes with `case`.
- Use the `!` one when you expect success: `File.read!("unknown")` says `could not read file … no such file or directory`.
- Avoid `{:ok, body} = File.read(path)`. It still fails, but with a cryptic `MatchError` instead of the real cause.

## Path

`Path` builds and expands paths, and handles operating-system differences (slashes on Windows):

```elixir
Path.join("foo", "bar")      #=> "foo/bar"
Path.expand("~/hello")       #=> "/Users/jose/hello"
```

## IO devices are processes

`File.open/2` returns `{:ok, pid}` because the file *is* a process. `IO.write(pid, …)` sends it a message and waits for a reply. Write
to a closed file and you're messaging a dead process, hence `:terminated`. Because devices are processes, the VM can even read and write
files across nodes.

<Diagram name="io-and-the-file-system/io-process" caption="IO functions are messages to a device process." />

## iodata and chardata

Most IO functions accept a **list** of binaries and integers, nested to any depth, instead of one string. Why? Strings are immutable, so
`"Hello " <> name <> "!"` copies `name` into a new binary. A list just points at the originals:

```elixir
IO.puts(["Hello ", name, "!"])
```

<Diagram name="io-and-the-file-system/iodata-copy" caption="A list of pieces avoids copying large strings." />

That's also why `Enum.intersperse(["apple", "banana", "lemon"], ",")` beats `Enum.join/2` when the result is going straight to IO. Nesting works
(`["apple", [",", "banana", [",", "lemon"]]]`), and so do integers: `?,` is `44`.

What an integer means depends on the device:

- **iodata**: integers are **bytes**
- **chardata**: integers are **Unicode code points**

For ASCII they're the same. Charlists are chardata.

<Diagram name="io-and-the-file-system/iodata-chardata" caption="The device's encoding decides between iodata and chardata." />

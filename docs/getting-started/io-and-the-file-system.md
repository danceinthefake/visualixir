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

<UnderTheHood>

**From your call to the disk.** `File.read!/1` and `File.write!/2` end in system calls made by an OS thread named `erts_dios_N`: one of the VM's *dirty IO schedulers*. The VM keeps these apart from the normal schedulers that run your processes, so a slow disk blocks one of them and not your processes ([dirty NIFs](https://www.erlang.org/doc/apps/erts/erl_nif.html)). This machine has 10 (`:erlang.system_info(:dirty_io_schedulers)`).

<Diagram name="io-and-the-file-system/syscalls" caption="The system calls a file read and a file write make, and where the data waits." />

Tracing the calls with `strace -f -y -Y` showed:

| In Elixir | System calls |
|---|---|
| `File.read!(path)` | `openat`, `fstat`, `readv`, `close` |
| `File.write!(path, iodata)` | `openat`, `fstat`, `writev`, `close` |
| `:file.sync(file)` | adds `fsync` |

**Where the data waits.** When `writev` returns, the kernel has the data in its page cache, which is not the same as on the disk. `fsync` is how a program asks for the file's data to be flushed to the device ([`fsync(2)`](https://man7.org/linux/man-pages/man2/fsync.2.html)). `File.read!` copies data from the kernel into a buffer that becomes a binary. A binary over 64 bytes lives outside the heap, and your process holds a small reference: a 5,000-byte binary measured 8 words.

**A detail about iodata.** Passing a list to `File.write!` saved building one big binary in your own code. In the trace, though, the file layer gathered the pieces into a single buffer before the system call: one `writev` with one 4013-byte buffer. That is what OTP 29 did for this call, and other functions, such as socket writes, may behave differently.

**A process, or just a handle.** `File.open/2` normally returns a pid, because the file is served by a device process, as above. With the `:raw` option it returns a plain handle (`{:file_descriptor, :prim_file, ...}`) and no process. The Erlang docs call this faster, since no process handles the file, but the `io` module can't be used on it and only the process that opened it can use it ([`file:open/2`](https://www.erlang.org/doc/apps/kernel/file.html)).

```console
$ strace -f -y -Y -e trace=openat,readv,writev,fsync,close elixir script.exs
```

*Sources:* the traces above were captured on Linux with Erlang/OTP 29 and Elixir 1.20. System call names are Linux's; other systems differ. [Dirty NIFs](https://www.erlang.org/doc/apps/erts/erl_nif.html) are documented in the Erlang docs.

</UnderTheHood>

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

For ASCII they're the same. Charlists are chardata. A file opened without an encoding expects iodata (use the `bin*` functions), while `:stdio` and files opened with `:utf8` expect chardata.

<Diagram name="io-and-the-file-system/iodata-chardata" caption="The device's encoding decides between iodata and chardata." />

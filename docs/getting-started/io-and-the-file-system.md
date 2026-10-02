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

**Below the VM: the kernel.** Your program can't touch the disk itself. It asks the kernel with a *system call* (`writev`, `fsync`, and so on), which switches the CPU from user mode to kernel mode ([syscalls(2)](https://man7.org/linux/man-pages/man2/syscalls.2.html)). On this machine the file system is ext4. `writev` copies your data into the *page cache*, a part of RAM the kernel uses to hold file data ([page cache docs](https://docs.kernel.org/mm/page_cache.html)), marks those pages *dirty* (changed but not yet written), and returns. Measured with `/proc/meminfo`, a 256 MB `File.write!` returned after 100 ms while "Dirty" grew from 28 MB to 290 MB: the data was in RAM and nowhere else. A 64 MiB write took 46 ms in `strace -T`. The kernel writes dirty pages to the disk later, in the background. `fsync` waits until it has: 6.2 s for the 256 MB, after which Dirty fell back to 25 MB, and 1.64 s for the 64 MiB. So when `File.write!` returns, the data is not yet safe on the disk. Reading works the other way round: if the data is already in the page cache the kernel copies it from RAM, and otherwise it reads the disk first.

**Below the VM: the hardware.** Under ext4, this machine has three more layers (`lsblk -s`). First dm-crypt, the kernel's disk encryption, which this volume uses. Then an NVMe driver, which sends commands to the drive over PCIe. Last, the drive itself: a Toshiba KXG50ZNV512G SSD whose own controller stores the data in flash memory. `fsync` reaches all the way down: the man page says it includes "flushing a disk cache if present" and blocks "until the device reports that the transfer has completed" ([fsync(2)](https://man7.org/linux/man-pages/man2/fsync.2.html)).

<Diagram name="io-and-the-file-system/kernel-stack" caption="A write returns once the data is in the page cache. It reaches the SSD later, or at fsync." />

*Sources:* the traces above were captured on Linux with Erlang/OTP 29 and Elixir 1.20. System call names and the disk layers are Linux's and this machine's; other systems differ. [Dirty NIFs](https://www.erlang.org/doc/apps/erts/erl_nif.html) are documented in the Erlang docs.

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

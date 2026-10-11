# IO and the file system

Source: [Elixir guide, IO and the file system](https://elixir.hexdocs.pm/io-and-the-file-system.html).

## IO

`IO` reads from and writes to standard input and output (`:stdio`), standard error (`:stderr`), files, and other IO devices. The default is stdin and stdout. To change that, pass a device:

```elixir
IO.puts("hello world")
IO.gets("yes or no? ")            #=> "yes\n"
IO.puts(:stderr, "hello world")
```

## File

`File` opens files as IO devices. Files open in binary mode, so use `IO.binwrite/2` and `IO.binread/2`. Pass `:utf8` to read as UTF-8. Use `:append` and not `:write` to keep the existing content. **`:write` deletes what is already there.**

```elixir
{:ok, file} = File.open("path/to/file/hello", [:write])
IO.binwrite(file, "world")
File.close(file)
File.read("path/to/file/hello")   #=> {:ok, "world"}
```

`File` also has UNIX-style operations: `rm/1`, `mkdir/1`, `mkdir_p/1`, `cp_r/2`, `rm_rf/1`.

### `read` or `read!`

Functions have two variants. The plain variant returns `{:ok, _}` or `{:error, reason}`. The `!` variant returns the bare result or raises an error.

- Use the plain variant when you handle both outcomes with `case`.
- Use the `!` variant when you expect success: `File.read!("unknown")` says `could not read file … no such file or directory`.
- Do not use `{:ok, body} = File.read(path)`. It also fails, but with a `MatchError` that hides the real cause.

## Path

`Path` builds and expands paths, and handles the differences between operating systems (slashes on Windows):

```elixir
Path.join("foo", "bar")      #=> "foo/bar"
Path.expand("~/hello")       #=> "/Users/jose/hello"
```

## IO devices are processes

`File.open/2` returns `{:ok, pid}` because the file *is* a process. `IO.write(pid, …)` sends it a message and waits for a reply. If you write to a closed file, you send a message to a dead process, and you get `:terminated`. Devices are processes, so the VM can also read and write files across nodes.

<Diagram name="io-and-the-file-system/io-process" caption="IO functions send messages to a device process." />

<UnderTheHood>

**In short:** a file write returns when the data is in RAM. The data reaches the disk later, or when you call `:file.sync`.

**From your call to the disk.** `File.read!/1` and `File.write!/2` end in system calls that an OS thread named `erts_dios_N` makes. This thread is one of the *dirty IO schedulers* of the VM. The VM keeps them apart from the normal schedulers that run your processes. A slow disk then blocks one of them and does not block your processes ([dirty NIFs](https://www.erlang.org/doc/apps/erts/erl_nif.html)). This machine has 10 of them (`:erlang.system_info(:dirty_io_schedulers)`).

<Diagram name="io-and-the-file-system/uth-syscalls" caption="The system calls that a file read and a file write make, and where the data waits." />

We traced the calls with `strace -f -y -Y`. The trace showed:

| In Elixir | System calls |
|---|---|
| `File.read!(path)` | `openat`, `fstat`, `readv`, `close` |
| `File.write!(path, iodata)` | `openat`, `fstat`, `writev`, `close` |
| `:file.sync(file)` | adds `fsync` |

**Where the data waits.** When `writev` returns, the kernel has the data in its page cache. This is not the same as on the disk. A program uses `fsync` to ask the kernel to flush the data of a file to the device ([`fsync(2)`](https://man7.org/linux/man-pages/man2/fsync.2.html)). `File.read!` copies data from the kernel into a buffer that becomes a binary. A binary of more than 64 bytes is outside the heap, and your process holds a small reference: a binary of 5,000 bytes measured 8 words.

**A detail about iodata.** When you pass a list to `File.write!`, you do not need to build one big binary in your own code. In the trace, however, the file layer gathered the pieces into a single buffer before the system call: one `writev` with one buffer of 4013 bytes. This is what OTP 29 did for this call. Other functions, for example socket writes, can behave in a different way.

**A process, or only a handle.** `File.open/2` normally returns a pid, because a device process serves the file, as above. With the `:raw` option, it returns a plain handle (`{:file_descriptor, :prim_file, ...}`) and no process. The Erlang docs call this faster, because no process handles the file. But you cannot use the `io` module on it, and only the process that opened it can use it ([`file:open/2`](https://www.erlang.org/doc/apps/kernel/file.html)).

```console
$ strace -f -y -Y -e trace=openat,readv,writev,fsync,close elixir script.exs
```

**Below the VM: the kernel.** Your program cannot touch the disk itself. It asks the kernel with a *system call* (`writev`, `fsync`, and so on). A system call switches the CPU from user mode to kernel mode ([syscalls(2)](https://man7.org/linux/man-pages/man2/syscalls.2.html)). On this machine, the file system is ext4. `writev` copies your data into the *page cache*, a part of RAM that the kernel uses to hold file data ([page cache docs](https://docs.kernel.org/mm/page_cache.html)). It marks those pages *dirty* (changed but not yet written), and returns. We measured with `/proc/meminfo`: a 256 MB `File.write!` returned after 100 to 210 ms (three runs) while "Dirty" grew by about 260 MB. The data was in RAM and nowhere else. A write of 64 MiB took 15 to 46 ms in `strace -T`.

Later, in the background, the kernel writes the dirty pages to the disk. `fsync` waits until the kernel did this. It took 6.1 to 6.7 s for the 256 MB, and then Dirty fell back to about where it started. It took 1.6 to 2.1 s for the 64 MiB. The `fsync` time depends strongly on the state of the disk. So when `File.write!` returns, the data is not yet safe on the disk. Reading works in the opposite way. If the data is already in the page cache, the kernel copies it from RAM. If not, the kernel first reads the disk.

**Below the VM: the hardware.** Under ext4, this machine has three more layers (`lsblk -s`). The first is dm-crypt, the disk encryption of the kernel, which this volume uses. The second is an NVMe driver, which sends commands to the drive over PCIe. The last is the drive itself: a Toshiba KXG50ZNV512G SSD. Its own controller stores the data in flash memory. `fsync` reaches all the way down. The man page says that it includes "flushing a disk cache if present". It also says that it blocks "until the device reports that the transfer has completed" ([fsync(2)](https://man7.org/linux/man-pages/man2/fsync.2.html)).

<Diagram name="io-and-the-file-system/uth-kernel-stack" caption="A write returns when the data is in the page cache. The data reaches the SSD later, or at fsync." />

*Sources:* we captured the traces above on Linux with Erlang/OTP 29 and Elixir 1.20. The names of the system calls and the disk layers are the names of Linux and of this machine. Other systems are different. The Erlang docs describe [Dirty NIFs](https://www.erlang.org/doc/apps/erts/erl_nif.html).

</UnderTheHood>

## iodata and chardata

Most IO functions accept a **list** of binaries and integers, nested to any depth, and not one string. Why? Strings are immutable, so `"Hello " <> name <> "!"` copies `name` into a new binary. A list only points to the originals:

```elixir
IO.puts(["Hello ", name, "!"])
```

<Diagram name="io-and-the-file-system/iodata-copy" caption="A list of pieces prevents the copy of large strings." />

For the same reason, `Enum.intersperse(["apple", "banana", "lemon"], ",")` is better than `Enum.join/2` when the result goes straight to IO. Nesting works (`["apple", [",", "banana", [",", "lemon"]]]`), and integers also work: `?,` is `44`.

The meaning of an integer depends on the device:

- **iodata**: integers are **bytes**.
- **chardata**: integers are **Unicode code points**.

For ASCII, they are the same. Charlists are chardata. A file that you open without an encoding expects iodata (use the `bin*` functions). `:stdio` and files that you open with `:utf8` expect chardata.

<Diagram name="io-and-the-file-system/iodata-chardata" caption="The encoding of the device decides between iodata and chardata." />

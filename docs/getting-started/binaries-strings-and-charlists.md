# Binaries, strings, and charlists

Source: [Elixir guide, Binaries, strings, and charlists](https://elixir.hexdocs.pm/binaries-strings-and-charlists.html).

A string is a binary, a binary is a bitstring, and a charlist is a list. This chapter sorts out which is which.

<Diagram name="binaries-strings-and-charlists/nesting" caption="Every string is a binary and every binary is a bitstring. Not every binary is a valid string." />

## Code points and UTF-8

Unicode gives every character a number, its **code point**. `?a` is `97`, `?ł` is `322`. `"\u0061"`
writes a character by its hex code point, so `"\u0061" == "a"`.

A code point is *what* is stored. An **encoding** is *how*. Elixir strings are UTF-8, a variable-width
encoding that uses 1 to 4 bytes per code point.

<Diagram name="binaries-strings-and-charlists/utf8" caption="&quot;hełło&quot;: five characters, five code points, seven bytes. ł is two bytes." />

```elixir
"héllo" |> String.length()   #=> 5
"héllo" |> byte_size()       #=> 6

"hełło" <> <<0>>
#=> <<104, 101, 197, 130, 197, 130, 111, 0>>   (the exact bytes)

IO.inspect("hełło", binaries: :as_binaries)
#=> <<104, 101, 197, 130, 197, 130, 111>>
```

A **grapheme** is what a reader sees as one character. It can be several code points: the woman
firefighter emoji is woman + zero-width joiner + fire engine. `String.codepoints/1` returns three,
`String.graphemes/1` and `String.length/1` see one.

## Bitstrings and binaries

`<<>>` builds a **bitstring**, a contiguous run of bits. Each entry is 8 bits unless you say
otherwise with `::n`.

```elixir
<<42>> == <<42::8>>                    #=> true
<<0::1, 0::1, 1::1, 1::1>> == <<3::4>> #=> true
<<1>> == <<257>>                       #=> true   (257 doesn't fit in 8 bits, it's truncated)
```

A **binary** is a bitstring whose bit count is divisible by 8.

```elixir
is_bitstring(<<3::4>>)   #=> true
is_binary(<<3::4>>)      #=> false
is_binary(<<0, 255, 42>>) #=> true
```

You can pattern match on binaries. Each entry matches exactly one byte unless you add a modifier:

```elixir
<<0, 1, x>> = <<0, 1, 2>>              # x = 2
<<0, 1, x>> = <<0, 1, 2, 3>>           #=> ** (MatchError)
<<0, 1, x::binary>> = <<0, 1, 2, 3>>   # x = <<2, 3>>
<<head::binary-size(2), rest::binary>> = <<0, 1, 2, 3>>
```

## Strings are binaries

A string is a UTF-8 binary. `<>` is really *binary* concatenation, so `<<0, 1>> <> <<2, 3>>` works.
Not every binary is a valid string: `String.valid?(<<239, 191, 19>>)` is `false`.

Matching a string works on **bytes**, not characters. Use the `utf8` modifier to match a whole
character:

```elixir
<<x, rest::binary>> = "über"
x == ?ü            #=> false   (x is the first byte of ü)

<<x::utf8, rest::binary>> = "über"
x == ?ü            #=> true    rest is "ber"
```

<Diagram name="binaries-strings-and-charlists/utf8-match" caption="Without utf8 the pattern takes one byte. With utf8 it takes as many as the character needs." />

## Charlists

A charlist is a list of integers that are valid code points. You mostly meet them when calling older
Erlang libraries that don't take binaries.

```elixir
~c"hello"            #=> ~c"hello"
[?h, ?e, ?l, ?l, ?o] #=> ~c"hello"
~c"hełło"            #=> [104, 101, 322, 322, 111]
```

IEx prints a list as `~c"…"` only when every number is in the ASCII range, so `[99, 97, 116]` shows
as `~c"cat"`. `inspect(list, charlists: :as_list)` forces the list form. `to_string/1` and
`to_charlist/1` convert, and `to_string/1` also takes atoms and numbers.

Strings use `<>`, charlists (being lists) use `++`. Mixing them fails: `~c"this " <> ~c"fails"`
raises `ArgumentError`.

<UnderTheHood>

**In memory.** A binary of up to 64 bytes lives on the process heap. A larger one lives outside every heap, and the heap holds only a small reference to it ([binary handling](https://www.erlang.org/doc/system/binaryhandling.html)). Measured: 64 bytes took 10 words, and 65 bytes or more a constant 8 words, however long. A charlist is a list, and a list cell is 2 words (16 bytes) per character. So 1000 characters took 16,000 bytes as a charlist and 1000 bytes as a binary.

**In the hardware.** The CPU reads memory in 64-byte *cache lines* (`getconf LEVEL1_DCACHE_LINESIZE`). One line holds 64 characters of a binary, but only 4 cells of a charlist. Reading 1000 characters straight through touches about 16 lines for the binary, and at best about 250 for the charlist, which is only that few if its cells happen to sit next to each other. That fits Elixir using binaries for text. Charlists mostly turn up when calling older Erlang libraries, as the chapter says.

<Diagram name="binaries-strings-and-charlists/uth-cache-lines" caption="The same text in a binary and in a charlist, counted in cache lines." />

*Sources:* sizes measured with `:erts_debug.flat_size/1` on Erlang/OTP 29. The 64-byte boundary matches the Erlang docs. The cache line size is this CPU's.

</UnderTheHood>

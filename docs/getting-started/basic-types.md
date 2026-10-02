# Basic types

Source: [Elixir guide, Basic types](https://elixir.hexdocs.pm/basic-types.html).

Integers, floats, atoms (booleans and `nil` among them) and strings. Lists and tuples come next.

<Diagram name="basic-types/family" caption="Booleans and nil are atoms. Strings are binaries. Lists and tuples are covered next." />

## Numbers

```elixir
1 + 2      #=> 3
5 * 5      #=> 25
10 / 2     #=> 5.0
```

`/` always returns a float. For integer division and remainder use `div/2` and `rem/2`:

```elixir
div(10, 2)   #=> 5
rem(10, 3)   #=> 1
```

Binary, octal and hex literals are integers too (`0b1010`, `0o777`, `0x1F`). Floats are 64-bit and
support scientific notation (`1.0e-10`). `round/1` gives the closest integer, `trunc/1` drops the
fraction.

<UnderTheHood>

**In memory.** Every value a process handles is one 8-byte *word*. A small integer is stored inside the word itself, so `42` needs no heap at all (`:erts_debug.flat_size(42)` is `0`). "Small" means 60 bits: up to 2^59 - 1 on this machine, and one more makes a *bignum*, an object on the heap (2^59 took 2 words, 2^100 took 3). A float is an object of 2 words on the heap. These sizes were measured on a 64-bit Erlang/OTP 29. The [Erlang memory guide](https://www.erlang.org/doc/system/memory.html) gives the same 60-bit range, and an older, larger figure for floats and bignums.

<Diagram name="basic-types/uth-word" caption="Small integers and atoms live inside the word. Floats and bignums are objects on the heap." />

**On the CPU.** `1 + 2` is compiled to a `gc_bif` `+` instruction (seen with `:beam_disasm`), which the VM runs as native machine code. When both numbers are small and fit in the word, the result needs no heap, because there is no object to build.

</UnderTheHood>

## Booleans and `nil`

`and`, `or` and `not` are strict: the left side must be a boolean, or you get a `BadBooleanError`.
They short-circuit, so the right side runs only when the left doesn't settle the answer.

```elixir
1 and true
#=> ** (BadBooleanError) expected a boolean on left-side of "and", got: 1

false and raise("never raised")   #=> false
```

`||`, `&&` and `!` accept any value. Only `false` and `nil` are falsy. `0` and `""` are truthy,
unlike in some other languages.

<Diagram name="basic-types/truthy" caption="Two falsy values. Everything else is truthy." />

Rule of thumb: booleans in, use `and` / `or` / `not`. Anything else, use `&&` / `||` / `!`.

## Atoms

An atom is a constant whose value is its own name. Two atoms are equal when their names are equal.
They usually stand for the state of an operation: `:ok`, `:error`.

`true`, `false` and `nil` are atoms, and the leading `:` is optional for them:

```elixir
true == :true       #=> true
is_atom(false)      #=> true
```

<UnderTheHood>

**In memory.** An atom is a word that holds an *index* into the atom table, a single table for the whole VM (`:erlang.system_info(:atom_count)`). The text of the atom is stored once, there. Measured, creating 10,000 new atoms grew the atom memory by about 34 bytes each. Comparing two atoms compares two words, which is why `:ok` and `:error` are such cheap tags. The memory guide notes that the table is never garbage-collected, and this VM stops at 1,048,576 atoms (`:atom_limit`), which is why the guides warn against turning user input into atoms.

<Diagram name="basic-types/uth-atom-table" caption="An atom is an index into one table for the whole VM. The table only grows." />

*Sources:* the [Erlang memory guide](https://www.erlang.org/doc/system/memory.html) for the atom table. Sizes and the per-atom cost were measured on Erlang/OTP 29.

</UnderTheHood>

## Strings

Strings are UTF-8, in double quotes. `<>` concatenates (both sides must be strings). `#{}`
interpolates any value that can become a string.

```elixir
"hello " <> "world!"        #=> "hello world!"
"i am #{42} years old!"     #=> "i am 42 years old!"
```

Internally a string is a contiguous sequence of bytes, a binary. So bytes and characters can differ:

```elixir
byte_size("hellö")       #=> 6
String.length("hellö")   #=> 5
```

<Diagram name="basic-types/bytes" caption="&quot;ö&quot; is one grapheme but two bytes in UTF-8, so byte_size and String.length disagree." />

<UnderTheHood>

**Why `byte_size` and `String.length` differ so much.** The official naming conventions say a function named `size` runs in constant time because the size is stored alongside the data, while `length` has to traverse it. A string is a binary, so `byte_size/1` reads that stored number. `String.length/1` has to read the bytes, decode UTF-8 (1 to 4 bytes per character) and work out where each grapheme ends. On a 56 MB string with accented letters, `byte_size` was below a microsecond and `String.length` took about 1.3 seconds on this machine.

<Diagram name="basic-types/uth-length" caption="byte_size reads one stored number. String.length walks every byte." />

The same holds for lists and tuples: on a million elements, `length/1` took about 21 ms and `tuple_size/1` under a microsecond.

</UnderTheHood>

## Structural comparison

`==`, `!=`, `<`, `<=`, `>`, `>=` work across any types. `1 == 1.0` is `true`; use `===` to tell an
integer from a float (`1 === 1.0` is `false`).

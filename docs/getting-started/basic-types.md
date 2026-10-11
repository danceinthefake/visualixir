# Basic types

Source: [Elixir guide, Basic types](https://elixir.hexdocs.pm/basic-types.html).

This chapter covers integers, floats, atoms (booleans and `nil` are atoms), and strings. Lists and tuples come next.

<Diagram name="basic-types/family" caption="Booleans and nil are atoms. Strings are binaries. The next chapter covers lists and tuples." />

## Numbers

```elixir
1 + 2      #=> 3
5 * 5      #=> 25
10 / 2     #=> 5.0
```

`/` always returns a float. For integer division and the remainder, use `div/2` and `rem/2`:

```elixir
div(10, 2)   #=> 5
rem(10, 3)   #=> 1
```

Binary, octal, and hex literals are also integers (`0b1010`, `0o777`, `0x1F`). Floats are 64-bit and support scientific notation (`1.0e-10`). `round/1` gives the closest integer. `trunc/1` removes the fraction.

<UnderTheHood>

**In memory.** Every value that a process handles is one 8-byte *word*. A small integer is stored inside the word itself, so `42` needs no heap (`:erts_debug.flat_size(42)` is `0`). "Small" means 60 bits: up to 2^59 - 1 on this machine. One more makes a *bignum*, an object on the heap (2^59 took 2 words, 2^100 took 3 words). A float is an object of 2 words on the heap. We measured these sizes on a 64-bit Erlang/OTP 29. The [Erlang memory guide](https://www.erlang.org/doc/system/memory.html) gives the same 60-bit range, and an older, larger value for floats and bignums.

<Diagram name="basic-types/uth-word" caption="Small integers and atoms are inside the word. Floats and bignums are objects on the heap." />

**On the CPU.** The compiler compiles `1 + 2` to a `gc_bif` `+` instruction (we saw it with `:beam_disasm`), which the VM runs as native machine code. When both numbers are small and fit in the word, the result needs no heap, because there is no object to build.

</UnderTheHood>

## Booleans and `nil`

`and`, `or`, and `not` are strict: the left side must be a boolean. If not, you get a `BadBooleanError`. They short-circuit, so the right side runs only when the left side does not decide the answer.

```elixir
1 and true
#=> ** (BadBooleanError) expected a boolean on left-side of "and", got: 1

false and raise("never raised")   #=> false
```

`||`, `&&`, and `!` accept any value. Only `false` and `nil` are falsy. `0` and `""` are truthy, which is different from some other languages.

<Diagram name="basic-types/truthy" caption="Two falsy values. All other values are truthy." />

Rule of thumb: for booleans, use `and`, `or`, and `not`. For all other values, use `&&`, `||`, and `!`.

## Atoms

An atom is a constant with a value that is its own name. Two atoms are equal when their names are equal. They usually show the state of an operation: `:ok`, `:error`.

`true`, `false`, and `nil` are atoms, and for them the leading `:` is optional:

```elixir
true == :true       #=> true
is_atom(false)      #=> true
```

<UnderTheHood>

**In memory.** An atom is a word that holds an *index* into the atom table. This is a single table for the whole VM (`:erlang.system_info(:atom_count)`). The text of the atom is stored once, there. When we created 10,000 new atoms, the atom memory grew by about 34 bytes for each atom. To compare two atoms, the VM compares two words. For this reason, `:ok` and `:error` are very cheap tags. The memory guide says that the VM never garbage-collects the table, and this VM stops at 1,048,576 atoms (`:atom_limit`). For this reason, the guides warn against the conversion of user input to atoms.

<Diagram name="basic-types/uth-atom-table" caption="An atom is an index into one table for the whole VM. The table only grows." />

*Sources:* the [Erlang memory guide](https://www.erlang.org/doc/system/memory.html) for the atom table. We measured the sizes and the cost for each atom on Erlang/OTP 29.

</UnderTheHood>

## Strings

Strings are UTF-8 and use double quotes. `<>` concatenates strings (both sides must be strings). `#{}` interpolates any value that can become a string.

```elixir
"hello " <> "world!"        #=> "hello world!"
"i am #{42} years old!"     #=> "i am 42 years old!"
```

Internally, a string is a contiguous sequence of bytes, a binary. For this reason, the number of bytes and the number of characters can be different:

```elixir
byte_size("hellö")       #=> 6
String.length("hellö")   #=> 5
```

<Diagram name="basic-types/bytes" caption="&quot;ö&quot; is one grapheme but two bytes in UTF-8, so byte_size and String.length give different values." />

<UnderTheHood>

**Why `byte_size` and `String.length` differ so much.** The official naming conventions say that a function with the name `size` runs in constant time, because the size is stored with the data. `length` must traverse the data. A string is a binary, so `byte_size/1` reads the stored number. `String.length/1` must read the bytes, decode UTF-8 (1 to 4 bytes for each character), and find where each grapheme ends. On a 56 MB string with accented letters, `byte_size` took less than a microsecond and `String.length` took about 1.3 seconds on this machine.

<Diagram name="basic-types/uth-length" caption="byte_size reads one stored number. String.length walks every byte." />

The same is true for lists and tuples: on a million elements, `length/1` took 8 to 21 ms (two runs) and `tuple_size/1` took less than a microsecond.

</UnderTheHood>

## Structural comparison

`==`, `!=`, `<`, `<=`, `>`, and `>=` work across any types. `1 == 1.0` is `true`. To tell an integer from a float, use `===` (`1 === 1.0` is `false`).

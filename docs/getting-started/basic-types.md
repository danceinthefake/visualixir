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

## Structural comparison

`==`, `!=`, `<`, `<=`, `>`, `>=` work across any types. `1 == 1.0` is `true`; use `===` to tell an
integer from a float (`1 === 1.0` is `false`).

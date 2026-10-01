# Sigils

Source: [Elixir guide, Sigils](https://elixir.hexdocs.pm/sigils.html).

Sigils give the language custom textual literals. They start with `~`, then one lowercase letter or one or more uppercase letters, then a
delimiter, the content, the closing delimiter, and optional modifiers.

<Diagram name="sigils/anatomy" caption="~r/foo/i is sugar for calling sigil_r/2." />

## Regular expressions

`~r` builds a PCRE regex. Modifiers go after the last delimiter:

```elixir
"foo" =~ ~r/foo|bar/    #=> true
"HELLO" =~ ~r/hello/    #=> false
"HELLO" =~ ~r/hello/i   #=> true
```

Eight delimiters are allowed: `/ | " ' ( ) [ ] { } < >`. Pick one that avoids escaping: `~r(^https?://)` reads better than `~r/^https?:\/\//`.

## Text sigils

| Sigil | Builds | Example |
|---|---|---|
| `~s` | a string | `~s(has "double" quotes)` |
| `~c` | a charlist | `~c(cat)` |
| `~w` | a list of words | `~w(foo bar bat)` gives `["foo", "bar", "bat"]` |

`~w` takes `c`, `s` or `a` modifiers for the element type: `~w(foo bar bat)a` is `[:foo, :bar, :bat]`.

## Lower vs UPPER case

Most lowercase sigils have an uppercase twin. The lowercase one handles escapes (`\n`, `\x26`, `\u{1F600}`, …) and `#{}` interpolation.
The uppercase one takes the text literally.

<Diagram name="sigils/lower-upper" caption="~S is what you want when writing escapes in docs." />

The escape codes available in textual sigils:

| Code | Meaning |
|---|---|
| `\\` | single backslash |
| `\a` | bell/alert |
| `\b` | backspace |
| `\d` | delete |
| `\e` | escape |
| `\f` | form feed |
| `\n` | newline |
| `\r` | carriage return |
| `\s` | space |
| `\t` | tab |
| `\v` | vertical tab |
| `\0` | null byte |
| `\xDD` | one byte in hex, such as `\x13` |
| `\uDDDD`, `\u{D...}` | a Unicode code point in hex, such as `\u{1F600}` |

Heredocs (`"""`) work with sigils, so `@doc ~S"""` avoids double-escaping in documentation.

## Calendar sigils

| Sigil | Builds |
|---|---|
| `~D[2019-10-31]` | `%Date{}` |
| `~T[23:00:07.0]` | `%Time{}` |
| `~N[2019-10-31 23:00:07]` | `%NaiveDateTime{}`, no timezone ("naive") |
| `~U[2019-10-31 19:59:03Z]` | `%DateTime{}` in UTC |

## Custom sigils

Define `sigil_{char}` functions. The content arrives as a string and the modifiers as a charlist:

```elixir
defmodule MySigils do
  def sigil_i(string, []), do: String.to_integer(string)
  def sigil_i(string, [?n]), do: -String.to_integer(string)
end

import MySigils
~i(13)    #=> 13
~i(42)n   #=> -42
```

A custom sigil is one lowercase letter, or an uppercase letter followed by uppercase letters and digits. Sigils are often used to embed
templating languages or other small languages.

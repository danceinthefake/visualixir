# Sigils

Source: [Elixir guide, Sigils](https://elixir.hexdocs.pm/sigils.html).

Sigils give the language custom textual literals. A sigil starts with `~`. Then it has one lowercase letter or one or more uppercase letters, an opening delimiter, the content, a closing delimiter, and optional modifiers.

<Diagram name="sigils/anatomy" caption="~r/foo/i is short for a call to sigil_r/2." />

## Regular expressions

`~r` builds a PCRE regular expression. Modifiers go after the last delimiter:

```elixir
"foo" =~ ~r/foo|bar/    #=> true
"HELLO" =~ ~r/hello/    #=> false
"HELLO" =~ ~r/hello/i   #=> true
```

You can use eight delimiters: `/ | " ' ( ) [ ] { } < >`. Pick one that avoids escapes. `~r(^https?://)` is easier to read than `~r/^https?:\/\//`.

## Text sigils

| Sigil | Builds | Example |
|---|---|---|
| `~s` | a string | `~s(has "double" quotes)` |
| `~c` | a charlist | `~c(cat)` |
| `~w` | a list of words | `~w(foo bar bat)` gives `["foo", "bar", "bat"]` |

`~w` takes the modifiers `c`, `s`, or `a` for the type of the elements: `~w(foo bar bat)a` is `[:foo, :bar, :bat]`.

## Lowercase and uppercase

Most lowercase sigils have an uppercase twin. The lowercase sigil handles escapes (`\n`, `\x26`, `\u{1F600}`, and others) and `#{}` interpolation. The uppercase sigil takes the text as it is.

<Diagram name="sigils/lower-upper" caption="Use ~S when you write escapes in docs." />

These are the escape codes in textual sigils:

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

Heredocs (`"""`) work with sigils. For this reason, `@doc ~S"""` prevents double escapes in documentation.

## Calendar sigils

| Sigil | Builds |
|---|---|
| `~D[2019-10-31]` | `%Date{}` |
| `~T[23:00:07.0]` | `%Time{}` |
| `~N[2019-10-31 23:00:07]` | `%NaiveDateTime{}`, with no time zone ("naive") |
| `~U[2019-10-31 19:59:03Z]` | `%DateTime{}` in UTC |

## Custom sigils

Define `sigil_{char}` functions. The content arrives as a string and the modifiers arrive as a charlist:

```elixir
defmodule MySigils do
  def sigil_i(string, []), do: String.to_integer(string)
  def sigil_i(string, [?n]), do: -String.to_integer(string)
end

import MySigils
~i(13)    #=> 13
~i(42)n   #=> -42
```

A custom sigil is one lowercase letter, or an uppercase letter that is followed by uppercase letters and digits. People often use sigils to embed templating languages or other small languages.

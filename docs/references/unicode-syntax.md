# Unicode syntax

Source: [Elixir reference, Unicode syntax](https://elixir.hexdocs.pm/unicode-syntax.html).

Strings (`"olá"`) and charlists support Unicode since v1.0 and keep their contents exactly as you write them. Strings are UTF-8 and charlists are lists of code points. Since v1.5, **variables, atoms, and calls** also allow Unicode. `String.Unicode.version()` shows the Unicode version of your installation.

## Introduction

Unicode characters must still obey the syntax rules: variables and calls cannot start with an uppercase letter. The allowed characters are the characters that Unicode specifies for the writing systems of languages that people still use. Emoji, alternate numeric forms, and musical notes are excluded. Many restrictions exist for security:

<Diagram name="unicode-syntax/identifiers" caption="What an identifier can contain." />

- **Normalization.** You can write "josé" as `j o s é` (NFC) or as `j o s e` with a separate accent character (NFD). Elixir normalizes to **NFC**.
- **No mixed scripts** unless an `_` separates them. A variable `аdmin`, with a Cyrillic `а` and Latin letters, raises `** (SyntaxError) invalid mixed-script identifier found: аdmin` and lists the script of each character.
- **Confusable identifiers** in the same file give a warning: `а` (Cyrillic) and `а` (Latin).

<Diagram name="unicode-syntax/mixed-script" caption="Scripts can mix only where Unicode allows it, or across an underscore." />

## Unicode Standard Annex #31 (identifiers)

Elixir conforms to UAX #31 (version 17.0).

**R1. Default identifiers:** `<Identifier> := <Start> <Continue>* <Ending>?`.

- `<Start>`: uppercase, lowercase, titlecase, modifier and other letters, letter numbers, plus `Other_ID_Start`, minus `Pattern_Syntax` and `Pattern_White_Space`. In set notation `[\p{L}\p{Nl}\p{Other_ID_Start}-\p{Pattern_Syntax}-\p{Pattern_White_Space}]`, normalized to NFC.
- `<Continue>`: `ID_Start` plus nonspacing and spacing combining marks, decimal numbers, connector punctuation and `Other_ID_Continue`, minus the same two sets.
- `<Ending>`: an Elixir addition, only `?` (003F) and `!` (0021).
- `<Medial>` is empty. ZWJ and ZWNJ are not allowed (R1a is not implemented), and bidirectional control characters are not supported.

**Atoms** follow that rule, and `_` is also allowed at the start and `@` is also allowed in `<Continue>`. Quoted atoms (`:"hello elixir"`) allow anything, and all operators are atoms.

**Variables and calls** allow `_` at the start. They exclude uppercase (Lu) and titlecase (Lt) letters at the start: `[\u{005F}\p{Ll}\p{Lm}\p{Lo}\p{Nl}\p{Other_ID_Start}-\p{Pattern_Syntax}-\p{Pattern_White_Space}]`.

**Aliases** allow only ASCII, start with an uppercase letter, and have no punctuation.

**R3. Pattern_White_Space and Pattern_Syntax:** Elixir supports only `\t`, `\n`, `\r`, and space as whitespace, so it does not follow R3.

**R4. Equivalent normalized identifiers:** identifiers are case-sensitive. Since v1.14, Elixir normalizes atoms and variables to NFC. The parser does not verify quoted atoms and strings, and they keep their form.

<Diagram name="unicode-syntax/normalization" caption="Elixir normalizes only unquoted names." />

The choice of R4 excludes R5, R6, and R7.

## Unicode Technical Standard #39 (security)

Elixir conforms to UTS #39 (version 17.0).

- **C1. General security profile:** Elixir does not tokenize identifiers with code points in `Identifier_Status=Restricted` (with the normalizations below). For example, the often invisible HANGUL FILLER gives a warning.
- **C2. Confusable detection:** identifiers that look alike but are different, within one file, give a warning. For example, in `а = a = 1` the two a's are Cyrillic and Latin, and in `力 = カ = 1` both are Japanese but they are different code points. Identifiers that contain only `a-z`, `A-Z`, `0-9`, and `_` are exempt, because programmers already handle `l`/`1` and `O`/`0` with fonts.
- **C3. Mixed script detection:** Elixir does not tokenize mixed-script identifiers unless underscore chunks split them (`http_сервер`). `幻한` is correct because Han mixes with Japanese and Korean (UTS 39 5.1). Latin with Japanese needs an underscore: `:T_シャツ`. `if аdmin, do: :ok, else: :err` fails with a descriptive error.
- **C4, C5:** not applicable. C4 (restriction levels) classifies arbitrary strings, and C5 (mixed numbers) does not apply because Elixir does not support Unicode numbers.

### Additional normalizations

Since v1.14, Elixir normalizes some restricted code points to unrestricted code points. Currently only MICRO SIGN (`µ`) becomes Greek lowercase mu (`μ`). The normalized character gets the union of both scriptsets ({Greek, Common}). `Common` intersects every scriptset, so the character can appear in any script without mixing. The affected code points are code points that the community uses, for example for microseconds.

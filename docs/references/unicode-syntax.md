# Unicode syntax

Source: [Elixir reference, Unicode syntax](https://elixir.hexdocs.pm/unicode-syntax.html).

Strings (`"olá"`) and charlists support Unicode since v1.0 and keep their contents exactly as written. Strings are UTF-8, charlists are lists of code points. Since v1.5, **variables, atoms and calls** also allow Unicode. `String.Unicode.version()` shows the Unicode version of your installation.

## Introduction

Unicode characters must still obey the syntax rules: variables and calls can't start with an uppercase letter. The allowed characters are the ones Unicode specifies for the writing systems of languages still in use. Emoji, alternate numeric forms and musical notes are excluded. Many
restrictions exist for security:

<Diagram name="unicode-syntax/identifiers" caption="What an identifier can be made of." />

- **Normalization.** "josé" can be written as `j o s é` (NFC) or `j o s e` plus a separate accent character (NFD). Elixir normalizes to **NFC**.
- **No mixed scripts** unless separated by `_`. A variable `аdmin`, with a Cyrillic `а` and Latin letters, raises `** (SyntaxError) invalid mixed-script identifier found: аdmin` and lists each character's script.
- **Confusable identifiers** in the same file warn: `а` (Cyrillic) and `а` (Latin).

<Diagram name="unicode-syntax/mixed-script" caption="Scripts can mix only where Unicode says they can, or across an underscore." />

## Unicode Standard Annex #31 (identifiers)

Elixir conforms to UAX #31 (version 17.0).

**R1. Default identifiers:** `<Identifier> := <Start> <Continue>* <Ending>?`.

- `<Start>`: uppercase, lowercase, titlecase, modifier and other letters, letter numbers, plus `Other_ID_Start`, minus `Pattern_Syntax` and `Pattern_White_Space`. In set notation `[\p{L}\p{Nl}\p{Other_ID_Start}-\p{Pattern_Syntax}-\p{Pattern_White_Space}]`, normalized to NFC.
- `<Continue>`: `ID_Start` plus nonspacing and spacing combining marks, decimal numbers, connector punctuation and `Other_ID_Continue`, minus the same two sets.
- `<Ending>`: an Elixir addition, only `?` (003F) and `!` (0021).
- `<Medial>` is empty. ZWJ and ZWNJ are not allowed (R1a isn't implemented), and bidirectional control characters aren't supported.

**Atoms** follow that rule, with `_` also allowed at the start and `@` also allowed in `<Continue>`. Quoted atoms (`:"hello elixir"`) allow anything, and all operators are atoms.

**Variables and calls** allow `_` at the start and exclude uppercase (Lu) and titlecase (Lt) letters at the start: `[\u{005F}\p{Ll}\p{Lm}\p{Lo}\p{Nl}\p{Other_ID_Start}-\p{Pattern_Syntax}-\p{Pattern_White_Space}]`.

**Aliases** allow only ASCII, starting uppercase, with no punctuation.

**R3. Pattern_White_Space and Pattern_Syntax:** Elixir supports only `\t`, `\n`, `\r` and space as whitespace, so it doesn't follow R3.

**R4. Equivalent normalized identifiers:** identifiers are case-sensitive, and atoms and variables are normalized to NFC (since v1.14). Quoted atoms and strings are not verified and keep their form.

<Diagram name="unicode-syntax/normalization" caption="Only unquoted names are normalized." />

Choosing R4 excludes R5, R6 and R7.

## Unicode Technical Standard #39 (security)

Elixir conforms to UTS #39 (version 17.0).

- **C1. General security profile:** identifiers with code points in `Identifier_Status=Restricted` aren't tokenized (with the normalizations below). The often invisible HANGUL FILLER, for example, triggers a warning.
- **C2. Confusable detection:** identifiers that look alike but differ, within one file, warn. Example: in `а = a = 1` the two a's are Cyrillic and Latin, and in `力 = カ = 1` both are Japanese but different code points. Identifiers made only of `a-z`, `A-Z`, `0-9` and `_` are exempt, because programmers already handle `l`/`1` and `O`/`0` with fonts.
- **C3. Mixed script detection:** mixed-script identifiers aren't tokenized unless split by underscore chunks (`http_сервер`). `幻한` is fine because Han mixes with Japanese and Korean (UTS 39 5.1), while Latin with Japanese needs an underscore: `:T_シャツ`. `if аdmin, do: :ok, else: :err` fails with a descriptive error.
- **C4, C5:** inapplicable. C4 (restriction levels) classifies arbitrary strings, and C5 (mixed numbers) doesn't apply since Unicode numbers aren't supported.

### Additional normalizations

Since v1.14 some restricted code points are normalized to unrestricted ones. Currently only MICRO SIGN (`µ`) becomes Greek lowercase mu (`μ`). The normalized character gets the union of both scriptsets ({Greek, Common}), and `Common` intersects every scriptset, so it can appear in any script without causing mixing. The affected code points are ones the community uses, such as for microseconds.

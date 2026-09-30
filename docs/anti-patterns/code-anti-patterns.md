# Code-related anti-patterns

Source: [Elixir guide, Code-related anti-patterns](https://elixir.hexdocs.pm/code-anti-patterns.html).

Anti-patterns tied to code and Elixir idioms. Ten of them.

## Comments overuse

**Problem:** commenting self-explanatory code makes it *less* readable.

```elixir
# Get the current time
now = DateTime.utc_now()
# Add five minutes in seconds
unix_now + (60 * 5)
```

**Refactoring:** use clear function and variable names, drop the noise, and name magic numbers with an attribute: `@five_min_in_seconds 60 * 5`. Elixir separates *documentation* (`@doc`,
`@moduledoc`) from code comments.

## Complex `else` clauses in `with`

**Problem:** flattening all error handling into one `else` block makes it hard to tell which step an error came from.

```elixir
with {:ok, encoded} <- File.read(path),
     {:ok, decoded} <- Base.decode64(encoded) do
  {:ok, String.trim(decoded)}
else
  {:error, _} -> {:error, :badfile}
  :error -> {:error, :badencoding}
end
```

**Refactoring:** normalize each step's return in a small private function (`file_read/1`, `base_decode64/1`), so `with` handles only the success path.

<Diagram name="code-anti-patterns/with-else" caption="Normalize the error next to the call that produces it." />

## Complex extractions in clauses

**Problem:** extracting values across several clauses and arguments mixes what is used for matching and guards with what is used only in the body. With many clauses you can't tell at a glance which is which.

```elixir
def drive(%User{name: name, age: age}) when age >= 18, do: "#{name} can drive"
```

**Refactoring:** extract only the pattern and guard variables in the signature and pull the rest inside the body:

```elixir
def drive(%User{age: age} = user) when age >= 18 do
  %User{name: name} = user
  "#{name} can drive"
end
```

## Dynamic atom creation

**Problem:** atoms are **not garbage collected**, and the VM allows 1,048,576 of them by default. Turning uncontrolled strings (a request, a response) into atoms lets outsiders exhaust memory or the atom limit.

```elixir
%{status: String.to_atom(status), message: message}
```

**Refactoring:** map strings to atoms explicitly, or use `String.to_existing_atom/1`:

```elixir
defp convert_status("ok"), do: :ok
defp convert_status("error"), do: :error
defp convert_status("redirect"), do: :redirect
```

`to_existing_atom/1` only works if the atom already exists, and it must be defined **inside a function of the same module** (not in a module attribute or the module body, which only runs at compile time).

<Diagram name="code-anti-patterns/atoms" caption="Keep the set of atoms fixed and known." />

## Long parameter list

**Problem:** functions with too many arguments have a confusing interface and invite mistakes: `loan(user_name, email, password, user_alias, book_title, book_ed)`.

**Refactoring:** group related arguments in maps, structs, or keyword lists (for optional ones): `loan(%{name: …, email: …} = user, %{title: …, ed: …} = book)`. For a private function, split into a map of data that may change and one of read-only data. If the arguments are truly
unrelated, the function is doing too much: split it.

## Namespace trespassing

**Problem:** a library defines modules outside its own namespace. A package `:my_lib` should keep everything under `MyLib`. The VM loads **one instance of a module at a time**, so two packages defining the same name are incompatible, and the owner may add that name later.

<Diagram name="code-anti-patterns/namespace" caption="plug_auth must not define Plug.Auth." />

```elixir
defmodule Plug.Auth do   # bad: inside Plug's namespace
defmodule PlugAuth do    # good
```

**Exceptions:** protocol implementations (they live under the protocol), namespaces whose owner allows it (Mix tasks under `Mix.Tasks`), and when you maintain both packages.

## Non-assertive map access

**Problem:** `map[:key]` on a key that must exist returns `nil` when it's missing, and the `nil` travels until something fails far away.

| Notation | Key exists | Key missing | Use for |
|---|---|---|---|
| `map.key` | the value | raises `KeyError` | structs, maps with known atom keys |
| `map[:key]` | the value | `nil` | any `Access` structure, optional keys |

```elixir
{point[:x], point[:y], point[:z]}    # a missing :x becomes nil
{point.x, point.y, point[:z]}        # :x and :y required, :z optional
```

<Diagram name="code-anti-patterns/assertive-access" caption="Fail at the access, not three calls later." />

Pattern matching is another option: `def plot(%{x: x, y: y, z: z})` and `def plot(%{x: x, y: y})` check that the keys exist and extract in one step, raising `FunctionClauseError` otherwise. Structs (with `@enforce_keys`) only allow static access, at the cost of a compile-time dependency.

## Non-assertive pattern matching

**Problem:** defensive code that always returns *something*, even for input it wasn't written for, hides bugs. `Enum.at(String.split(pair, "="), 1)` on `"university=institution=UFMG"` quietly returns `"institution"`.

**Refactoring:** match what you expect. Anything else crashes with a clear error:

```elixir
[key, value] = String.split(pair, "=")
```

Same for `case`: match `{:ok, value}` and `{:error, _}` explicitly, not a bare `_`, which hides new return values added later.

## Non-assertive truthiness

**Problem:** `&&`, `||` and `!` accept any value. When both operands are booleans, that's more general than needed.

```elixir
if is_binary(name) && is_integer(age)     # before
if is_binary(name) and is_integer(age)    # after: asserts a boolean
```

It matters most with Erlang APIs, which never return `nil` but may return `:error` or `:undefined`. Those are truthy in Elixir.

## Structs with 32 fields or more

**Problem:** structs are maps. Maps with fewer than 32 keys are **flat maps**: keys in one tuple, values in another, and updates share the key tuple. Larger maps become **hash maps**, which don't share keys. Structs with 32 or more fields also lose the compile-time sharing of the key tuple between `%User{}` instances, so memory use grows.

<Diagram name="code-anti-patterns/struct-32" caption="Under 32 fields, every struct shares one tuple of keys." />

**Refactoring:** keep it under 32. Nest optional fields in one `:metadata` field, nest rarely used fields in a sub-struct, or group fields that change together in a tuple. Balance this against the ergonomics of fields that are read and written often.

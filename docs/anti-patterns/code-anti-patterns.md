# Code-related anti-patterns

Source: [Elixir guide, Code-related anti-patterns](https://elixir.hexdocs.pm/code-anti-patterns.html).

These anti-patterns are about code and Elixir idioms. There are ten.

## Comments overuse

**Problem:** comments on self-explanatory code make it *less* readable.

```elixir
# Get the current time
now = DateTime.utc_now()
# Add five minutes in seconds
unix_now + (60 * 5)
```

**Refactoring:** use clear function and variable names, remove the noise, and name magic numbers with an attribute: `@five_min_in_seconds 60 * 5`. Elixir separates *documentation* (`@doc`, `@moduledoc`) from code comments.

## Complex `else` clauses in `with`

**Problem:** all error handling is in one `else` block, so it is hard to tell which step an error came from.

```elixir
with {:ok, encoded} <- File.read(path),
     {:ok, decoded} <- Base.decode64(encoded) do
  {:ok, String.trim(decoded)}
else
  {:error, _} -> {:error, :badfile}
  :error -> {:error, :badencoding}
end
```

**Refactoring:** normalize the return value of each step in a small private function (`file_read/1`, `base_decode64/1`), so that `with` handles only the success path.

<Diagram name="code-anti-patterns/with-else" caption="Normalize the error next to the call that produces it." />

## Complex extractions in clauses

**Problem:** the code extracts values across several clauses and arguments. This mixes what the code uses for matching and guards with what it uses only in the body. With many clauses, you cannot see at a glance which is which.

```elixir
def drive(%User{name: name, age: age}) when age >= 18, do: "#{name} can drive"
```

**Refactoring:** extract only the pattern and guard variables in the signature, and take the rest inside the body:

```elixir
def drive(%User{age: age} = user) when age >= 18 do
  %User{name: name} = user
  "#{name} can drive"
end
```

## Dynamic atom creation

**Problem:** the VM does **not garbage collect atoms**, and by default it allows 1,048,576 of them. If you turn uncontrolled strings (a request, a response) into atoms, outsiders can use up the memory or the atom limit.

```elixir
%{status: String.to_atom(status), message: message}
```

**Refactoring:** map strings to atoms explicitly, or use `String.to_existing_atom/1`:

```elixir
defp convert_status("ok"), do: :ok
defp convert_status("error"), do: :error
defp convert_status("redirect"), do: :redirect
```

`to_existing_atom/1` works only if the atom already exists. You must define the atom **inside a function of the same module** (not in a module attribute or the module body, which run only at compile time).

<Diagram name="code-anti-patterns/atoms" caption="Keep the set of atoms fixed and known." />

<UnderTheHood>

**Why the limit is the problem, not memory.** We created 10,000 new atoms, and the atom table grew by about 34 bytes for each atom (for short names). At this rate, the limit of 1,048,576 atoms is only about 35 MB. The table fills long before the machine runs out of memory, as the chapter says. We started a throwaway VM with a low limit (`erl +t 20000`) and created atoms past it. The VM stopped with `no more index entries in atom_tab (max=20000)` and wrote a crash dump. The VM never frees atoms, so anyone who can make your code create atoms can stop the whole node.

<Diagram name="code-anti-patterns/uth-atom-limit" caption="The atom table is small and the VM never frees it, so a full table stops the VM." />

*Sources:* we measured on Erlang/OTP 29 with `:erlang.memory/1` and `:erlang.system_info/1`. The [memory guide](https://www.erlang.org/doc/system/memory.html) says that the VM does not garbage-collect the atom table.

</UnderTheHood>

## Long parameter list

**Problem:** functions with too many arguments have a confusing interface and cause mistakes: `loan(user_name, email, password, user_alias, book_title, book_ed)`.

**Refactoring:** group related arguments in maps, structs, or keyword lists (for optional arguments): `loan(%{name: …, email: …} = user, %{title: …, ed: …} = book)`. For a private function, split the arguments into a map of data that can change and a map of read-only data. If the arguments are really unrelated, the function does too much. Split it.

## Namespace trespassing

**Problem:** a library defines modules outside its own namespace. A package `:my_lib` must keep everything under `MyLib`. The VM loads **one instance of a module at a time**, so two packages that define the same name are incompatible, and the owner can add that name later.

<Diagram name="code-anti-patterns/namespace" caption="plug_auth must not define Plug.Auth." />

```elixir
defmodule Plug.Auth do   # bad: inside Plug's namespace
defmodule PlugAuth do    # good
```

**Exceptions:** protocol implementations (they live under the protocol), namespaces where the owner allows it (Mix tasks under `Mix.Tasks`), and the case where you maintain both packages.

## Non-assertive map access

**Problem:** `map[:key]` on a key that must exist returns `nil` when the key is missing, and the `nil` travels until something fails far away.

| Notation | Key exists | Key missing | Use for |
|---|---|---|---|
| `map.key` | the value | raises `KeyError` | structs, maps with known atom keys |
| `map[:key]` | the value | `nil` | any `Access` structure, optional keys |

```elixir
{point[:x], point[:y], point[:z]}    # a missing :x becomes nil
{point.x, point.y, point[:z]}        # :x and :y required, :z optional
```

<Diagram name="code-anti-patterns/assertive-access" caption="Fail at the access and not three calls later." />

Pattern matching is another option: `def plot(%{x: x, y: y, z: z})` and `def plot(%{x: x, y: y})` make sure that the keys exist and extract them in one step. If a key is missing, they raise `FunctionClauseError`. Structs (with `@enforce_keys`) allow only static access, at the cost of a compile-time dependency.

<UnderTheHood>

**In short:** `point.x` is part of the code of your function, and `point[:x]` calls another function.

**Two different pieces of machine code.** We compiled `point.x` and `point[:x]` and read the result. `point.x` becomes checks and a load inside your own function, and a missing key goes straight to the code that raises `KeyError`. `point[:x]` becomes a call to `Access.get/2`. This function works for maps, keyword lists, and other types, and it returns `nil` when the key is missing. The dynamic form can do more. For the same reason, it cannot tell the compiler that the key must be there.

<Diagram name="code-anti-patterns/uth-map-access" caption="point.x is instructions in your function. point[:x] is a call to Access.get/2." />

*Sources:* we disassembled with `:beam_disasm` on Elixir 1.20 / OTP 29. `point.x` is `is_map` and `get_map_elements`, and `point[:x]` is `call_ext_only` to `Access.get/2`.

</UnderTheHood>

## Non-assertive pattern matching

**Problem:** defensive code that always returns *something*, also for input that the code was not written for, hides bugs. `Enum.at(String.split(pair, "="), 1)` on `"university=institution=UFMG"` quietly returns `"institution"`.

**Refactoring:** match what you expect. Any other input crashes with a clear error:

```elixir
[key, value] = String.split(pair, "=")
```

The same is true for `case`: match `{:ok, value}` and `{:error, _}` explicitly. Do not use a bare `_`, which hides new return values that someone adds later.

## Non-assertive truthiness

**Problem:** `&&`, `||`, and `!` accept any value. When both operands are booleans, this is more general than necessary.

```elixir
if is_binary(name) && is_integer(age)     # before
if is_binary(name) and is_integer(age)    # after: asserts a boolean
```

This is most important with Erlang APIs. They never return `nil`, but they can return `:error` or `:undefined`. These values are truthy in Elixir.

## Structs with 32 fields or more

**Problem:** structs are maps. Maps with fewer than 32 keys are **flat maps**: the keys are in one tuple, the values are in another tuple, and updates share the key tuple. Larger maps become **hash maps**, which do not share keys. Structs with 32 or more fields also lose the compile-time sharing of the key tuple between `%User{}` instances, so the memory use grows.

<Diagram name="code-anti-patterns/struct-32" caption="Under 32 fields, every struct shares one tuple of keys." />

**Refactoring:** keep the struct under 32 fields. Nest optional fields in one `:metadata` field, nest rarely used fields in a sub-struct, or group fields that change together in a tuple. Balance this against the ergonomics of fields that you read and write often.

<UnderTheHood>

**The extra key.** A struct is a map with one more key, `__struct__`, so a struct with 31 fields has 32 keys and a struct with 32 fields has 33 keys. We measured with `:erts_debug.size/1`. With 31 fields, 1000 instances with every field set cost about 37 words each, because they share one tuple of keys. With 32 fields, the cost was about 125 words each, 3.4 times more, and with 40 fields it was about 151 words. At 32 fields, the map is a hash tree (the Keywords and maps section shows the jump) and there is no key tuple to share. This is the cost that the anti-pattern describes.

One case went the other way. A copy of an existing struct with 40 fields and one changed field shared most of the tree and cost about 26 words, less than for a small struct. So the measured cost is about the creation of many structs with all their fields set, not about the update of one.

<Diagram name="code-anti-patterns/uth-struct-32" caption="At 32 fields, a struct stops sharing its keys, and each instance costs about three times more." />

*Sources:* we measured on Erlang/OTP 29, 64-bit. The threshold is the one in the official chapter and the [memory guide](https://www.erlang.org/doc/system/memory.html).

</UnderTheHood>

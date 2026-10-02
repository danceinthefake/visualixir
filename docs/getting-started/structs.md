# Structs

Source: [Elixir guide, Structs](https://elixir.hexdocs.pm/structs.html).

Structs extend maps with compile-time checks and default values.

## Defining and building

```elixir
defmodule User do
  defstruct name: "John", age: 27
end

%User{}                #=> %User{age: 27, name: "John"}
%User{name: "Jane"}    #=> %User{age: 27, name: "Jane"}
%User{oops: :field}    #=> ** (KeyError) key :oops not found expanding struct: User.__struct__/1
```

A struct is named after the module that defines it. Only the fields listed in `defstruct` may exist.

<Diagram name="structs/compile-check" caption="Unknown keys are rejected while compiling, not at runtime." />

## Access, update, match

Access and update work like a map with fixed keys. The update syntax never adds keys, so the underlying maps can share
their key structure in memory.

```elixir
john = %User{}
john.name                  #=> "John"
jane = %{john | name: "Jane"}
%{jane | oops: :field}     #=> ** (KeyError)

%User{name: name} = john   # name = "John"
%User{} = %{}              #=> ** (MatchError)
```

`%User{} = value` also checks that the value is a `User` struct.

## Dynamic updates

To update a struct from a keyword list or map whose fields you don't know until runtime, use `struct!/2`. It raises on invalid fields:

```elixir
john = %User{name: "John", age: 27}
struct!(john, name: "Jane", age: 30)   #=> %User{age: 30, name: "Jane"}
struct!(john, invalid: "field")
#=> ** (KeyError) key :invalid not found in: %User{age: 27, name: "John"}
```

Use `%{john | name: "Jane"}` when you know the fields at compile time, and always prefer `struct!/2` to the `Map` functions, to keep the struct intact.

## Structs are bare maps underneath

A struct is a map with one extra key, `__struct__`, holding the module name.

<Diagram name="structs/struct-underneath" caption="Same map, plus __struct__." />

```elixir
is_map(john)       #=> true
john.__struct__    #=> User
```

But structs don't inherit map features:

```elixir
john[:name]
#=> ** (UndefinedFunctionError) function User.fetch/2 is undefined (User does not implement the Access behaviour)
Enum.each(john, fn {field, value} -> IO.puts(value) end)
#=> ** (Protocol.UndefinedError) protocol Enumerable not implemented for %User{age: 27, name: "John"} of type User (a struct)
```

`john[:name]` fails because there is no `Access` behaviour, and `Enum.each(john, …)` raises `Protocol.UndefinedError`. You attach behaviour like this with [protocols](./protocols).

<UnderTheHood>

**In memory.** A struct is a map with one extra key, `__struct__`, so `%User{name: nil, age: nil, email: nil}` took 12 words against 10 for a plain map with the same three keys. The saving is in the keys. All structs of one kind share a single tuple of keys: 1000 of them took 12,005 words counted with sharing, and would take 17,000 if each carried its own. This is the optimisation the "Structs with 32 fields or more" anti-pattern refers to.

<Diagram name="structs/uth-shared-keys" caption="Every struct of a kind points at the same tuple of keys." />

*Sources:* measured with `:erts_debug.size/1` (counts shared parts once) and `:erts_debug.flat_size/1` on Erlang/OTP 29.

</UnderTheHood>

## Defaults and required keys

Omitted defaults are `nil`. Fields with implicit `nil` must come **first**, then the keyword list:

```elixir
defstruct [:email, name: "John", age: 27]
```

`@enforce_keys [:make]` makes a key mandatory when building, or `ArgumentError` at compile time. It isn't checked on
updates and it doesn't validate values.

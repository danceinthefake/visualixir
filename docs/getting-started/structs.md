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

A struct has the name of the module that defines it. Only the fields in `defstruct` can exist.

<Diagram name="structs/compile-check" caption="Elixir rejects unknown keys at compile time, not at runtime." />

## Access, update, match

Access and update work as they do for a map with fixed keys. The update syntax never adds keys, so the underlying maps can share their key structure in memory.

```elixir
john = %User{}
john.name                  #=> "John"
jane = %{john | name: "Jane"}
%{jane | oops: :field}     #=> ** (KeyError)

%User{name: name} = john   # name = "John"
%User{} = %{}              #=> ** (MatchError)
```

`%User{} = value` also makes sure that the value is a `User` struct.

## Dynamic updates

To update a struct from a keyword list or a map when you do not know the fields until runtime, use `struct!/2`. It raises an error for invalid fields:

```elixir
john = %User{name: "John", age: 27}
struct!(john, name: "Jane", age: 30)   #=> %User{age: 30, name: "Jane"}
struct!(john, invalid: "field")
#=> ** (KeyError) key :invalid not found in: %User{age: 27, name: "John"}
```

When you know the fields at compile time, use `%{john | name: "Jane"}`. Always use `struct!/2` and not the `Map` functions, to keep the struct intact.

## A struct is a map underneath

A struct is a map with one extra key, `__struct__`, that holds the module name.

<Diagram name="structs/struct-underneath" caption="The same map, plus __struct__." />

```elixir
is_map(john)       #=> true
john.__struct__    #=> User
```

But structs do not inherit the features of maps:

```elixir
john[:name]
#=> ** (UndefinedFunctionError) function User.fetch/2 is undefined (User does not implement the Access behaviour)
Enum.each(john, fn {field, value} -> IO.puts(value) end)
#=> ** (Protocol.UndefinedError) protocol Enumerable not implemented for %User{age: 27, name: "John"} of type User (a struct)
```

`john[:name]` fails because the struct has no `Access` behaviour. `Enum.each(john, …)` raises `Protocol.UndefinedError`. You add this type of behaviour with [protocols](./protocols).

<UnderTheHood>

**In memory.** A struct is a map with one extra key, `__struct__`. `%User{name: nil, age: nil, email: nil}` took 12 words. A plain map with the same three keys took 10 words. The saving is in the keys. All structs of one kind share a single tuple of keys. 1000 structs took 12,005 words, counted with sharing. Without the sharing, they take 17,000 words. The "Structs with 32 fields or more" anti-pattern refers to this optimization.

<Diagram name="structs/uth-shared-keys" caption="Every struct of a kind points to the same tuple of keys." />

*Sources:* we measured with `:erts_debug.size/1` (counts shared parts once) and `:erts_debug.flat_size/1` on Erlang/OTP 29.

</UnderTheHood>

## Defaults and required keys

Omitted defaults are `nil`. Fields with an implicit `nil` must come **first**, before the keyword list:

```elixir
defstruct [:email, name: "John", age: 27]
```

`@enforce_keys [:make]` makes a key mandatory when you build the struct. If the key is missing, you get an `ArgumentError` at compile time. Elixir does not enforce it on updates, and it does not validate values.

# Protocols

Source: [Elixir guide, Protocols](https://elixir.hexdocs.pm/protocols.html).

A protocol is polymorphism by data type. Here is the problem. A `type/1` function with one clause for each type works while the code is yours, but nobody else can extend it. With a protocol, **anyone can implement it, for any type, at any time**.

```elixir
defprotocol Utility do
  @spec type(t) :: String.t()
  def type(value)
end

defimpl Utility, for: BitString do
  def type(_value), do: "string"
end

defimpl Utility, for: Integer do
  def type(_value), do: "integer"
end
```

The `defimpl` blocks can be in different files. The dispatch is always on the type of the **first argument**.

<Diagram name="protocols/dispatch" caption="The protocol picks the implementation from the type of the first argument." />

## Example: Size

```elixir
defprotocol Size do
  @doc "Calculates the size (and not the length!) of a data structure"
  def size(data)
end

defimpl Size, for: BitString do
  def size(string), do: byte_size(string)
end
defimpl Size, for: Map do
  def size(map), do: map_size(map)
end
defimpl Size, for: Tuple do
  def size(tuple), do: tuple_size(tuple)
end
```

Lists have no implementation, because the length of a list is not pre-computed. `Size.size([1, 2, 3])` raises `Protocol.UndefinedError`. You can implement a protocol for `Atom`, `BitString`, `Float`, `Function`, `Integer`, `List`, `Map`, `PID`, `Port`, `Reference`, and `Tuple`.

<Diagram name="protocols/size" caption="One function and one implementation for each type." />

## Protocols and structs

A struct is a map, but it does not share the implementations of the map. `Size.size(%MapSet{})` fails until you write `defimpl Size, for: MapSet`. A struct needs its own implementation. This lets your own data types define what `size` means for them.

## Fallback to `Any`

It is tedious to write every implementation by hand. Implement the protocol for `Any`. Then use one of two methods:

- **derive**: `@derive [Size]` on a struct. This is explicit, and many libraries use it.
- **fall back**: `@fallback_to_any true` in the protocol. This opts in every type. It is a poor default, so it is off.

```elixir
defimpl Size, for: Any do
  def size(_), do: 0
end
```

<Diagram name="protocols/fallback" caption="The lookup order when you call a protocol function." />

<UnderTheHood>

**What a protocol call becomes.** A call such as `Enumerable.reduce(list, acc, fun)` first asks which module handles this kind of value. Then it calls that module. When `mix` compiles a project, it *consolidates* each protocol. The first step then becomes a few type checks and one jump that ends in a constant: the name of the module, for example `Enumerable.List`.

The [Protocol docs](https://hexdocs.pm/elixir/Protocol.html) describe a consolidated call as "equivalent to invoking two remote functions". One function identifies the implementation and one function calls it. Consolidation applies when "all protocol implementations are known up-front". For this reason, take care with implementations that you define later, for example only in tests.

<Diagram name="protocols/uth-dispatch" caption="A consolidated protocol picks the implementation with a few tests and a jump." />

*Sources:* we disassembled with `:beam_disasm` after `Protocol.consolidate/2` on Elixir 1.20. The checks are `is_map`, `get_map_elements` (to read the name of a struct), `is_atom`, and `select_val`. The shape of the generated code can change between Elixir versions.

</UnderTheHood>

## Built-in protocols

<Diagram name="protocols/builtin" caption="The functions that you already use are protocols underneath." />

- `Enumerable`: what `Enum` works with.
- `String.Chars`: `to_string/1`, and what `"#{value}"` calls. `"#{{1, 2, 3}}"` fails because tuples do not implement it.
- `Inspect`: `inspect/1`, and how IEx prints results. If the output starts with `#`, it is not valid Elixir, so inspect is not reversible.

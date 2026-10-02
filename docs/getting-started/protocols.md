# Protocols

Source: [Elixir guide, Protocols](https://elixir.hexdocs.pm/protocols.html).

A protocol is polymorphism by data type. The problem: a `type/1` function with a clause per type works while the code is yours,
but nobody else can extend it. With a protocol, **anyone can implement it, for any type, at any time**.

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

The `defimpl` blocks can live in different files. Dispatch is always on the type of the **first argument**.

<Diagram name="protocols/dispatch" caption="The protocol picks the implementation from the first argument's type." />

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

Lists get no implementation, because a list's length isn't pre-computed. Calling `Size.size([1, 2, 3])` raises
`Protocol.UndefinedError`. You can implement a protocol for `Atom`, `BitString`, `Float`, `Function`, `Integer`, `List`, `Map`, `PID`,
`Port`, `Reference` and `Tuple`.

<Diagram name="protocols/size" caption="One function, one implementation per type." />

## Protocols and structs

A struct is a map, but it doesn't share the map's implementations. `Size.size(%MapSet{})` fails until you write
`defimpl Size, for: MapSet`. Structs need their own implementation, which lets your own data types define what `size` means for them.

## Falling back to `Any`

Writing every implementation by hand gets tedious. Implement the protocol for `Any`, then either:

- **derive**: `@derive [Size]` on a struct, explicit, and the approach many libraries push towards, or
- **fall back**: `@fallback_to_any true` in the protocol, opt-in for every type (a poor default, so it's off).

```elixir
defimpl Size, for: Any do
  def size(_), do: 0
end
```

<Diagram name="protocols/fallback" caption="Lookup order when calling a protocol function." />

## Built-in protocols

<Diagram name="protocols/builtin" caption="Functions you already use are protocols underneath." />

- `Enumerable`: what `Enum` works with.
- `String.Chars`: `to_string/1`, and what `"#{value}"` calls. `"#{{1, 2, 3}}"` fails because tuples don't implement it.
- `Inspect`: `inspect/1`, and how IEx prints results. If the output starts with `#`, it isn't valid Elixir, so inspect isn't reversible.

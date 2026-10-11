# Comprehensions

Source: [Elixir guide, Comprehensions](https://elixir.hexdocs.pm/comprehensions.html).

`for` is a comprehension. It loops over an enumerable, keeps some elements, changes them, and collects the result. It has three parts: generators, filters, and collectables.

```elixir
for n <- [1, 2, 3, 4], do: n * n   #=> [1, 4, 9, 16]
```

## Generators and filters

`n <- [1, 2, 3, 4]` is the **generator**. Any enumerable works on the right side (`1..4`, a list, a map). The left side of a generator is a *pattern*. Elixir **skips** values that do not match the pattern, with no error:

```elixir
values = [good: 1, good: 2, bad: 3, good: 4]
for {:good, n} <- values, do: n * n   #=> [1, 4, 16]
```

<Diagram name="comprehensions/pattern-generator" caption="{:bad, 3} does not match the pattern, so Elixir skips it." />

**Filters** remove the elements for which the expression returns `false` or `nil`:

```elixir
for n <- 0..5, rem(n, 3) == 0, do: n * n   #=> [0, 9]
```

<Diagram name="comprehensions/pipeline" caption="The generator, then the filter, then the block, then the collectable." />

You can chain several generators and filters. This example lists the files in several directories and gets the size of each regular file. `path = ...` binds a value for the filter and the body that follow:

```elixir
dirs = ["/home/mikey", "/home/james"]

for dir <- dirs,
    file <- File.ls!(dir),
    path = Path.join(dir, file),
    File.regular?(path) do
  File.stat!(path).size
end
```

The later generators run inside the earlier ones, so two generators give the Cartesian product:

```elixir
for i <- [:a, :b, :c], j <- [1, 2], do: {i, j}
#=> [a: 1, a: 2, b: 1, b: 2, c: 1, c: 2]
```

<Diagram name="comprehensions/cartesian" caption="The inner generator runs to the end for every outer value." />

Variables that you bind inside a comprehension do not leak out.

## Bitstring generators

`<<r::8, g::8, b::8 <- pixels>>` reads a binary three bytes at a time:

```elixir
pixels = <<213, 45, 132, 64, 76, 32, 76, 0, 0, 234, 32, 15>>
for <<r::8, g::8, b::8 <- pixels>>, do: {r, g, b}
#=> [{213, 45, 132}, {64, 76, 32}, {76, 0, 0}, {234, 32, 15}]
```

## `:into`

The result is a list unless you pass `:into`. `:into` accepts any value that implements the `Collectable` protocol:

```elixir
for <<c <- " hello world ">>, c != ?\s, into: "", do: <<c>>          #=> "helloworld"
for {key, val} <- %{"a" => 1, "b" => 2}, into: %{}, do: {key, val * val}  #=> %{"a" => 1, "b" => 4}
```

<Diagram name="comprehensions/into" caption="into: chooses where the results go." />

`IO.stream/2` is both `Enumerable` and `Collectable`. This example is an echo terminal that prints back what you type, in uppercase. To leave it, press `Ctrl+C` twice:

```elixir
stream = IO.stream(:stdio, :line)
for line <- stream, into: stream, do: String.upcase(line) <> "\n"
```

`:reduce` and `:uniq` are other options. See the [`for` reference](https://elixir.hexdocs.pm/Kernel.SpecialForms.html#for/1).

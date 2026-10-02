# Anonymous functions

Source: [Elixir guide, Anonymous functions](https://elixir.hexdocs.pm/anonymous-functions.html).

Code you can store and pass around like an integer or string.

## Name and arity

A function is identified by **name and arity** (its argument count). `trunc/1` is a real function;
`trunc/2` is a different, nonexistent one. In IEx, `h trunc/1` prints the docs.

## Defining and calling

```elixir
add = fn a, b -> a + b end
add.(1, 2)   #=> 3
```

Arguments are left of `->`, the body right of it. Calling uses a **dot**, so there is never doubt
whether you are calling the variable `add` or a named function `add/2`. Without the dot you'd have
to scan all previous code to know what `is_atom(:foo)` means.

<Diagram name="anonymous-functions/call" caption="The dot decides which one you are calling." />

Check with `is_function(add)` (true) and `is_function(add, 2)` (true, exact arity), `is_function(add, 1)` (false).

## Closures

A function can use variables that were in scope where it was defined. Assigning inside a function
never changes the surrounding scope.

```elixir
double = fn a -> add.(a, a) end
double.(2)   #=> 4

x = 42
(fn -> x = 0 end).()   #=> 0
x                      #=> 42
```

<Diagram name="anonymous-functions/closure" caption="double closes over add. The inner x = 0 leaves the outer x alone." />

<UnderTheHood>

**In memory.** `fn x -> x + y end` makes an object on the heap, the *fun object*, that holds every variable it captured. The compiler shows it as two instructions: `test_heap` reserves room, then `make_fun3` builds the object with its list of captured variables. Calling it, `f.(a)`, is a `call_fun` instruction. Whatever the closure captured is part of it: a closure over a 10,000-element list measured 20,003 words.

**What that costs when you send it.** A message is copied into the receiver's heap, so sending that closure copied the whole list: the receiver grew by about 160 KB. Capture only what you need, and see the "Sending unnecessary data" anti-pattern.

<Diagram name="anonymous-functions/uth-closure" caption="A closure carries what it captured, and sending it copies all of it." />

*Sources:* instructions read with `:beam_disasm`, sizes with `:erts_debug.flat_size/1`, on Erlang/OTP 29. Message copying is documented in the [Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html).

</UnderTheHood>

## Clauses and guards

Like `case`, an anonymous function can have several clauses and guards. Every clause needs the same
number of arguments, or you get a `CompileError`.

```elixir
f = fn
  x, y when x > 0 -> x + y
  x, y -> x * y
end
f.(1, 3)    #=> 4
f.(-1, 3)   #=> -3
```

## The capture operator

`&` turns any `name/arity` into a function value: named functions, module functions, even operators.
It also shortens simple anonymous functions, where `&1` is the first argument.

```elixir
fun = &is_atom/1
fun.(:hello)              #=> true
(&String.length/1).("hello")   #=> 5
(&+/2).(1, 2)             #=> 3

&(&1 + 1)      # same as fn x -> x + 1 end
&"Good #{&1}"  # works with string interpolation too
```

<Diagram name="anonymous-functions/capture" caption="Every capture yields a function value you call with a dot." />

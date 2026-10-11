# Anonymous functions

Source: [Elixir guide, Anonymous functions](https://elixir.hexdocs.pm/anonymous-functions.html).

An anonymous function is code that you can store and pass around, as you do with an integer or a string.

## Name and arity

The **name and arity** (the number of arguments) identify a function. `trunc/1` is a real function. `trunc/2` is a different function that does not exist. In IEx, `h trunc/1` prints the docs.

## Defining and calling

```elixir
add = fn a, b -> a + b end
add.(1, 2)   #=> 3
```

The arguments are on the left of `->` and the body is on the right. You call the function with a **dot**. The dot makes it clear if you call the variable `add` or a named function `add/2`. Without the dot, you must read all the earlier code to know what `is_atom(:foo)` means.

<Diagram name="anonymous-functions/call" caption="The dot shows which function you call." />

Make sure that a value is a function with `is_function(add)` (true). `is_function(add, 2)` (true) checks the exact arity. `is_function(add, 1)` is false.

## Closures

A function can use the variables that were in scope where you defined it. An assignment inside a function never changes the outer scope.

```elixir
double = fn a -> add.(a, a) end
double.(2)   #=> 4

x = 42
(fn -> x = 0 end).()   #=> 0
x                      #=> 42
```

<Diagram name="anonymous-functions/closure" caption="double closes over add. The inner x = 0 does not change the outer x." />

<UnderTheHood>

**In memory.** `fn x -> x + y end` makes an object on the heap, the *fun object*. It holds every variable that it captured. The compiler shows it as two instructions. `test_heap` reserves room, and `make_fun3` builds the object with its list of captured variables. A call, `f.(a)`, is a `call_fun` instruction. The closure includes everything that it captured. A closure over a list of 10,000 elements measured 20,003 words.

**What that costs when you send it.** The system copies a message into the heap of the receiver. When we sent that closure, the system copied the whole list, and the receiver grew by about 160 KB. Capture only the data that you need. See the "Sending unnecessary data" anti-pattern.

<Diagram name="anonymous-functions/uth-closure" caption="A closure carries what it captured, and a send copies all of it." />

*Sources:* we read the instructions with `:beam_disasm` and measured the sizes with `:erts_debug.flat_size/1`, on Erlang/OTP 29. The [Efficiency Guide](https://www.erlang.org/doc/system/eff_guide_processes.html) describes message copying.

</UnderTheHood>

## Clauses and guards

As in `case`, an anonymous function can have several clauses and guards. Every clause must have the same number of arguments. If not, you get a `CompileError`.

```elixir
f = fn
  x, y when x > 0 -> x + y
  x, y -> x * y
end
f.(1, 3)    #=> 4
f.(-1, 3)   #=> -3
```

## The capture operator

`&` turns any `name/arity` into a function value: named functions, module functions, and operators. It also makes simple anonymous functions shorter. `&1` is the first argument.

```elixir
fun = &is_atom/1
fun.(:hello)              #=> true
(&String.length/1).("hello")   #=> 5
(&+/2).(1, 2)             #=> 3

&(&1 + 1)      # same as fn x -> x + 1 end
&"Good #{&1}"  # also works with string interpolation
```

<Diagram name="anonymous-functions/capture" caption="Every capture gives a function value that you call with a dot." />

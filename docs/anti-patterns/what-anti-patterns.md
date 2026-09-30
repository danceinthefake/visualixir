# What are anti-patterns?

Source: [Elixir guide, What are anti-patterns?](https://elixir.hexdocs.pm/what-anti-patterns.html).

Anti-patterns are common mistakes, or indicators of problems in code. They're also called "code smells". These guides document ones found in Elixir software so you can spot them and
know their pitfalls.

Matching an anti-pattern **doesn't mean the code must change**. Sometimes it's the best approach for the problem at hand. No codebase is free of them, and you shouldn't aim to remove them all.

<Diagram name="what-anti-patterns/categories" caption="25 patterns in four categories." />

- [Code-related](./code-anti-patterns): language idioms and features
- [Design-related](./design-anti-patterns): modules, functions and their role in a codebase
- [Process-related](./process-anti-patterns): processes and process-based abstractions
- [Meta-programming](./macro-anti-patterns): macros and code generation

Each entry has the same structure:

<Diagram name="what-anti-patterns/entry" caption="The same five parts every time." />

The initial catalog came from Lucas Vegi and Marco Tulio Valente (ASERG/DCC/UFMG), in *Understanding Code Smells in Elixir Functional Language*. For security guidance, the Security Working Group of the Erlang
Ecosystem Foundation publishes resources for Erlang and Elixir at security.erlef.org.

# What are anti-patterns?

Source: [Elixir guide, What are anti-patterns?](https://elixir.hexdocs.pm/what-anti-patterns.html).

Anti-patterns are common mistakes, or indicators of problems in code. People also call them "code smells". These guides document the anti-patterns that people found in Elixir software, so that you can see them and know their risks.

If code matches an anti-pattern, it **does not mean that you must change the code**. Sometimes the anti-pattern is the best approach for the problem. No codebase is free of anti-patterns, and you must not aim to remove all of them.

<Diagram name="what-anti-patterns/categories" caption="25 patterns in four categories." />

- [Code-related](./code-anti-patterns): language idioms and features
- [Design-related](./design-anti-patterns): modules, functions, and their role in a codebase
- [Process-related](./process-anti-patterns): processes and abstractions that use processes
- [Meta-programming](./macro-anti-patterns): macros and code generation

Each entry has the same structure:

<Diagram name="what-anti-patterns/entry" caption="The same five parts every time." />

The first catalog came from Lucas Vegi and Marco Tulio Valente (ASERG/DCC/UFMG), in *Understanding Code Smells in Elixir Functional Language*. For security guidance, the Security Working Group of the Erlang Ecosystem Foundation publishes resources for Erlang and Elixir at security.erlef.org.

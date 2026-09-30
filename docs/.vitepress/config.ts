import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Visualixir",
  description: "Elixir, drawn. The official Elixir docs, explained with diagrams.",
  lang: "en",
  base: process.env.DOCS_BASE ?? "/",
  cleanUrls: true,
  head: [
    // Mirror VitePress's saved appearance onto data-theme before first paint, so Bless tokens
    // (and the diagrams painted from them) don't flash the OS theme.
    [
      "script",
      {},
      `try{var a=localStorage.getItem("vitepress-theme-appearance");if(a==="dark"||a==="light")document.documentElement.dataset.theme=a}catch(e){}`,
    ],
  ],
  vite: { ssr: { noExternal: ["blessing-ui"] } },
  themeConfig: {
    nav: [
      { text: "Getting started", link: "/getting-started/introduction" },
      { text: "Mix & OTP", link: "/mix-and-otp/introduction-to-mix" },
      { text: "Meta-programming", link: "/meta-programming/quote-and-unquote" },
    ],
    sidebar: {
      "/getting-started/": [
        {
          text: "Getting started",
          items: [
            { text: "Introduction", link: "/getting-started/introduction" },
            { text: "Basic types", link: "/getting-started/basic-types" },
            { text: "Lists and tuples", link: "/getting-started/lists-and-tuples" },
            { text: "Pattern matching", link: "/getting-started/pattern-matching" },
            { text: "case, cond, and if", link: "/getting-started/case-cond-and-if" },
            { text: "Anonymous functions", link: "/getting-started/anonymous-functions" },
            { text: "Binaries, strings, and charlists", link: "/getting-started/binaries-strings-and-charlists" },
            { text: "Keyword lists and maps", link: "/getting-started/keywords-and-maps" },
            { text: "Modules and functions", link: "/getting-started/modules-and-functions" },
            { text: "alias, require, import, and use", link: "/getting-started/alias-require-and-import" },
            { text: "Module attributes", link: "/getting-started/module-attributes" },
            { text: "Structs", link: "/getting-started/structs" },
            { text: "Recursion", link: "/getting-started/recursion" },
            { text: "Enumerables and Streams", link: "/getting-started/enumerable-and-streams" },
            { text: "Comprehensions", link: "/getting-started/comprehensions" },
            { text: "Protocols", link: "/getting-started/protocols" },
            { text: "Sigils", link: "/getting-started/sigils" },
            { text: "try, catch, and rescue", link: "/getting-started/try-catch-and-rescue" },
            { text: "Processes", link: "/getting-started/processes" },
            { text: "IO and the file system", link: "/getting-started/io-and-the-file-system" },
            { text: "Writing documentation", link: "/getting-started/writing-documentation" },
            { text: "Optional syntax sheet", link: "/getting-started/optional-syntax" },
            { text: "Erlang libraries", link: "/getting-started/erlang-libraries" },
            { text: "Debugging", link: "/getting-started/debugging" },
          ],
        },
      ],
      "/meta-programming/": [
        {
          text: "Meta-programming",
          items: [
            { text: "Quote and unquote", link: "/meta-programming/quote-and-unquote" },
            { text: "Macros", link: "/meta-programming/macros" },
            { text: "Domain-Specific Languages", link: "/meta-programming/domain-specific-languages" },
          ],
        },
      ],
      "/mix-and-otp/": [
        {
          text: "Mix & OTP",
          items: [
            { text: "Introduction to Mix", link: "/mix-and-otp/introduction-to-mix" },
            { text: "Simple state with agents", link: "/mix-and-otp/agents" },
            { text: "Registries and supervision trees", link: "/mix-and-otp/supervisor-and-application" },
            { text: "Supervising dynamic children", link: "/mix-and-otp/dynamic-supervisor" },
            { text: "Task and gen_tcp", link: "/mix-and-otp/task-and-gen-tcp" },
            { text: "Doctests, patterns, and with", link: "/mix-and-otp/docs-tests-and-with" },
            { text: "Configuration and distribution", link: "/mix-and-otp/config-and-distribution" },
            { text: "Client-server with GenServer", link: "/mix-and-otp/genservers" },
            { text: "Releases", link: "/mix-and-otp/releases" },
          ],
        },
      ],
    },
    search: { provider: "local" },
    outline: [2, 3],
  },
});

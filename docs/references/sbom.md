# Software Bill of Materials

Source: [Elixir reference, Software Bill of Materials](https://elixir.hexdocs.pm/sbom.html).

A Software Bill of Materials (SBoM) is a structured, machine-readable inventory of the components in a software system: a detailed ingredient list.

<Diagram name="sbom/contents" caption="What a typical SBoM includes." />

Two widespread formats: **CycloneDX** (lightweight, designed for security) and **SPDX** (more comprehensive, originally about licensing), both in JSON or XML.

An SBoM is an **inventory, not a certification**. It doesn't claim the software is secure, compliant or free of vulnerabilities. Other tools consume it to assess that.

## Why generate one?

- **Vulnerability analysis.** When a CVE appears you need to know quickly whether you're affected. Tools like OWASP Dependency-Track continuously match your SBoMs against vulnerability databases and notify you. Without one, you check each project by hand.
- **Regulatory requirements.** US Executive Order 14028 (2021) requires SBoMs for certain software supplied to the federal government. The EU Cyber Resilience Act requires component inventories (commonly SBoMs) for products with digital elements. Safety-critical industries (medical, automotive, aerospace) often require them, and customers may ask.
- **License compliance.** An overview of the licenses in your dependency tree, flagging packages that need a closer look, and support for due diligence. Package-level licenses reflect what a package *declares*, not necessarily every license in its files. For thorough compliance use a file-level scanner such as ORT.

## Generating with mix_sbom

`mix_sbom` is an Erlang Ecosystem Foundation project that produces CycloneDX SBoMs for Elixir projects.

<Diagram name="sbom/flow" caption="From a Mix project to the tools that read the inventory." />

**Install** as a project dependency (`sbom` in `mix.exs`), as a global escript (`mix escript.install hex sbom`, Elixir 1.19.4+), or as a standalone binary from the releases page. The binary needs no Erlang or Elixir, which suits CI.

```console
$ mix_sbom cyclonedx /path/to/your/project
```

This creates `bom.cdx.json` with the complete dependency tree. Useful options: `-o, --output PATH` (default `bom.cdx.json`), `-t, --format FORMAT` (`json`, `xml` or `protobuf`) and `-s, --schema VERSION`.

```console
$ mix_sbom cyclonedx --format xml --output sbom.xml /path/to/project
```

## CI integration

A GitHub Action generates one on every published release and uploads it as an artifact:

```yaml
name: Generate SBoM
on:
  release:
    types: [published]

jobs:
  sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/mix_sbom@v0
        with:
          path: "."
          format: "json"
      - uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: bom.cdx.json
```

## Deeper analysis with ORT

A package may declare MIT but contain files under other licenses or vendored code. The OSS Review Toolkit (ORT) scans the actual source, and supports Mix projects:

- file-level license detection (license texts and SPDX identifiers)
- copyright holder identification
- policy enforcement for allowed and denied licenses
- multi-ecosystem support

ORT complements `mix_sbom` for organizations with strict compliance requirements.

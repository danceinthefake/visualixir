# Software Bill of Materials

Source: [Elixir reference, Software Bill of Materials](https://elixir.hexdocs.pm/sbom.html).

A Software Bill of Materials (SBoM) is a structured, machine-readable inventory of the components in a software system. It is a detailed list of ingredients.

<Diagram name="sbom/contents" caption="What a typical SBoM includes." />

Two formats are common: **CycloneDX** (lightweight, designed for security) and **SPDX** (broader, originally about licensing). Both use JSON or XML.

An SBoM is an **inventory and not a certification**. It does not claim that the software is secure, compliant, or free of vulnerabilities. Other tools use it to assess these properties.

## Why generate an SBoM?

- **Vulnerability analysis.** When a CVE appears, you must quickly know if it affects you. Tools such as OWASP Dependency-Track continuously match your SBoMs against vulnerability databases and send you notifications. Without an SBoM, you check each project by hand.
- **Regulatory requirements.** US Executive Order 14028 (2021) requires SBoMs for some software that is supplied to the federal government. The EU Cyber Resilience Act requires component inventories (commonly SBoMs) for products with digital elements. Safety-critical industries (medical, automotive, aerospace) often require them, and customers can ask for them.
- **License compliance.** An SBoM gives an overview of the licenses in your dependency tree, shows packages that need a closer look, and supports due diligence. Package-level licenses show what a package *declares*, not necessarily every license in its files. For thorough compliance, use a file-level scanner such as ORT.

## Generate an SBoM with mix_sbom

`mix_sbom` is a project of the Erlang Ecosystem Foundation. It produces CycloneDX SBoMs for Elixir projects.

<Diagram name="sbom/flow" caption="From a Mix project to the tools that read the inventory." />

**Install** it as a project dependency (`sbom` in `mix.exs`), as a global escript (`mix escript.install hex sbom`, Elixir 1.19.4+), or as a standalone binary from the releases page. The binary needs no Erlang or Elixir, which is good for CI.

```console
$ mix_sbom cyclonedx /path/to/your/project
```

This creates `bom.cdx.json` with the complete dependency tree. These options are useful: `-o, --output PATH` (default `bom.cdx.json`), `-t, --format FORMAT` (`json`, `xml`, or `protobuf`), and `-s, --schema VERSION`.

```console
$ mix_sbom cyclonedx --format xml --output sbom.xml /path/to/project
```

## CI integration

A GitHub Action generates an SBoM on every published release and uploads it as an artifact:

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

A package can declare MIT but contain files with other licenses or vendored code. The OSS Review Toolkit (ORT) scans the actual source and supports Mix projects:

- file-level license detection (license texts and SPDX identifiers)
- identification of copyright holders
- enforcement of policy for allowed and denied licenses
- support for many ecosystems

ORT complements `mix_sbom` for organizations with strict compliance requirements.

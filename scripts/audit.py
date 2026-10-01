#!/usr/bin/env python3
"""Audit the pages against the official Elixir chapters they derive from (the snapshot in upstream/).

Checks what a page SAYS is supported by its own chapter, and reports what it DROPPED:

  refs      qualified function references (Enum.map, :erlang.length) in code and inline code
  strings   string literals in code blocks
  atoms     atom literals in code blocks
  results   `#=> value` annotations
  numbers   numeric literals (1_048_576, 0x1F, v1.17)
  diagrams  the same refs and numbers in the labels of docs/diagrams/**/*.dot

A token counts as supported if it appears in the page's own chapter, or in any chapter for the
checks that allow it. Anything found in no chapter is a finding. Reviewed, harmless findings live
in scripts/audit-allow.json. It cannot judge prose: a wrong explanation built from correct terms passes.

  python3 scripts/audit.py            exit 1 on findings
  python3 scripts/audit.py --dropped  also list, per page, what the chapter has that the page lacks
"""
import collections, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DOCS = f"{ROOT}/upstream", f"{ROOT}/docs"
SECTIONS = ["getting-started", "mix-and-otp", "meta-programming", "anti-patterns", "cheatsheets", "references"]
ALLOW = json.load(open(f"{ROOT}/scripts/audit-allow.json"))

def norm(t):
    t = t.replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\b(iex|\.\.\.)\(?\d*\)?>\s?", "", t)  # iex> and ...> prompts

src = {os.path.basename(f)[:-3]: norm(open(f).read()) for f in glob.glob(f"{SRC}/*.md")}
anysrc = "\n".join(src.values())
squash = lambda t: re.sub(r"\s+", "", t)
anysq = squash(anysrc)

QUAL = re.compile(r"\b((?:[A-Z][A-Za-z0-9_]*\.)+[a-z_][A-Za-z0-9_]*[?!]?)")
ERL = re.compile(r"(:[a-z_]+\.[a-z_][A-Za-z0-9_]*[?!]?)")
STR = re.compile(r'"((?:[^"\\\n]|\\.)*)"')
ATOM = re.compile(r"(?<![A-Za-z0-9_:\"])(:[a-z_][A-Za-z0-9_]*[?!]?)")
NUM = re.compile(r"(?<![\w.#])(\d[\d_]{2,}|\d+\.\d+|0x[0-9A-Fa-f]+)(?![\w])")
RES = re.compile(r"#=>\s*(.+)")
WORD = re.compile(r"[A-Za-z_][A-Za-z0-9_?!]*|\d+")
LABEL = re.compile(r'label\s*=\s*"((?:[^"\\]|\\.)*)"')

fences = lambda md: re.findall(r"```[a-z]*\n(.*?)```", md, re.S)
inline = lambda md: re.findall(r"`([^`\n]+)`", re.sub(r"```.*?```", "", md, flags=re.S))

findings = collections.defaultdict(list)  # kind -> [(where, token)]
def add(kind, where, token):
    if token not in ALLOW.get(kind, []):
        findings[kind].append((where, token))

dropped = []
for sec in SECTIONS:
    for f in sorted(glob.glob(f"{DOCS}/{sec}/*.md")):
        slug = os.path.basename(f)[:-3]
        where = f"{sec}/{slug}"
        if slug not in src:
            findings["no_source"].append((where, f"upstream/{slug}.md")); continue
        md, own = open(f).read(), src[slug]
        code = "\n".join(fences(md))
        for r in sorted(set(QUAL.findall(code + "\n" + "\n".join(inline(md)))) | set(ERL.findall(code))):
            if r not in anysrc: add("refs", where, r)
        for s in sorted(set(STR.findall(code))):
            if len(s) >= 3 and s not in ("ok", "error") and s not in anysrc: add("strings", where, s)
        for a in sorted(set(ATOM.findall(code))):
            if a not in anysrc: add("atoms", where, a)
        for b in fences(md):
            for m in RES.findall(b):
                v = re.split(r"\s{2,}", m.strip())[0].rstrip(",")                      # drop my trailing note
                v = re.sub(r"\s*\(.*\)$", "", v) if v.endswith(")") and v.count("(") == v.count(")") == 1 and not v.startswith("**") else v
                if len(v) < 2 or squash(v) in anysq: continue
                frags = [squash(x) for x in re.split(r"\.\.\.|…", v) if len(squash(x)) > 2]
                if "..." in v and frags and all(x in anysq for x in frags): continue    # abbreviated value
                add("results", where, v)
        for n in sorted(set(NUM.findall(re.sub(r"<[^>]*>", " ", md)))):
            if n not in ("2012", "2021", "2025", "2026", "0.7") and n not in anysrc: add("numbers", where, n)
        # what the chapter has that the page lacks (informational)
        scode = "\n".join(fences(own)) + "\n" + "\n".join(inline(own))
        refs = {r for r in set(QUAL.findall(scode)) | set(ERL.findall(scode)) if not r.startswith(("Enum.Out", "IEx."))}
        dropped.append((where, len(refs), sorted(r for r in refs if r not in md)))

for f in sorted(glob.glob(f"{DOCS}/diagrams/*/*.dot")):
    slug, where = f.split("/")[-2], "diagrams/" + "/".join(f.split("/")[-2:])
    if slug not in src: findings["no_source"].append((where, f"upstream/{slug}.md")); continue
    labels = " ".join(LABEL.findall(open(f).read())).replace('\\"', '"').replace("\\n", " ").replace("\\l", " ")
    for r in sorted(set(QUAL.findall(labels)) | set(ERL.findall(labels))):
        if r not in anysrc: add("diagram_refs", where, r)
    for n in sorted(set(NUM.findall(labels))):
        if n not in anysrc: add("diagram_numbers", where, n)

n = sum(len(v) for v in findings.values())
print(f"audited {len(dropped)} pages and {len(glob.glob(f'{DOCS}/diagrams/*/*.dot'))} diagrams against upstream/")
for kind, items in findings.items():
    print(f"\n{kind}: {len(items)} not found in any official chapter")
    for where, tok in items[:25]: print(f"  {where}: {tok}")
if "--dropped" in sys.argv:
    print("\nwhat the chapter has that the page lacks (>35% of its function refs), informational:")
    for where, total, lost in sorted(dropped, key=lambda d: -(len(d[2]) / max(1, d[1]))):
        if total >= 4 and len(lost) / total > 0.35: print(f"  {where}: {len(lost)}/{total} -> {lost[:6]}")
print("\n" + (f"{n} finding(s)" if n else "no findings"))
sys.exit(1 if n else 0)

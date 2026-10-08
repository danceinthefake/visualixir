// Gives the first mention of each glossary term on a page a hover card (<GlossTerm>). Only running text is touched:
// never headings, links, code, or the glossary page itself. Terms and their definitions are in glossary.json.
import type MarkdownIt from "markdown-it";
import glossary from "./glossary.json";

type Term = { id: string; match: string[]; in?: string[] };
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// longest first, so "supervision trees" wins over "supervisor" and "exit signals" over "exit signal"
const compiled = (glossary.terms as Term[]).map((t) => ({
  ...t,
  re: new RegExp(`(?<![\\w\\-/])(${[...t.match].sort((a, b) => b.length - a.length).map(escape).join("|")})(?![\\w-])`),
}));

export default function glossaryPlugin(md: MarkdownIt) {
  md.core.ruler.push("glossary", (state) => {
    const rel = (state.env as { relativePath?: string }).relativePath ?? "";
    const path = rel.replace(/\.md$/, "");
    if (!path || path === "index" || path === "glossary") return;
    const here = compiled.filter((t) => !t.in || t.in.some((p) => path.startsWith(p)));
    // one card per term in the running text, and another per term inside an "Under the hood" section (closed at first)
    const seen = { text: new Set<string>(), hood: new Set<string>() };
    let hood = false;
    const { Token } = state;
    state.tokens.forEach((block, i) => {
      if (block.type === "html_block") {
        if (/<UnderTheHood>/.test(block.content)) hood = true;
        if (/<\/UnderTheHood>/.test(block.content)) hood = false;
      }
      const used = hood ? seen.hood : seen.text;
      if (block.type !== "inline" || !block.children || state.tokens[i - 1]?.type === "heading_open") return;
      const out: InstanceType<typeof Token>[] = [];
      let inLink = 0;
      for (const tok of block.children) {
        if (tok.type === "link_open") inLink++;
        if (tok.type === "link_close") inLink--;
        if (tok.type !== "text" || inLink) { out.push(tok); continue; }
        let rest = tok.content;
        for (;;) {
          // the earliest mention of any term not used yet
          let best: { t: (typeof here)[number]; at: number; text: string } | undefined;
          for (const t of here) {
            if (used.has(t.id)) continue;
            const m = t.re.exec(rest);
            if (m && (!best || m.index < best.at)) best = { t, at: m.index, text: m[1] };
          }
          if (!best) break;
          used.add(best.t.id);
          if (best.at) { const before = new Token("text", "", 0); before.content = rest.slice(0, best.at); out.push(before); }
          const open = new Token("html_inline", "", 0); open.content = `<GlossTerm id="${best.t.id}">`;
          const word = new Token("text", "", 0); word.content = best.text;
          const close = new Token("html_inline", "", 0); close.content = "</GlossTerm>";
          out.push(open, word, close);
          rest = rest.slice(best.at + best.text.length);
        }
        if (rest) { const after = new Token("text", "", 0); after.content = rest; out.push(after); }
      }
      block.children = out;
    });
  });
}

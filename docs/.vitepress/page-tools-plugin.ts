// Puts <PageTools> right after a page's title, with the number of "Under the hood" sections on the page.
import type MarkdownIt from "markdown-it";

export default function pageToolsPlugin(md: MarkdownIt) {
  md.core.ruler.push("page-tools", (state) => {
    const rel = (state.env as { relativePath?: string }).relativePath ?? "";
    if (!rel || rel === "index.md") return;
    const hoods = state.tokens.filter((t) => t.type === "html_block" && /<UnderTheHood>/.test(t.content)).length;
    const at = state.tokens.findIndex((t) => t.type === "heading_close" && t.tag === "h1");
    if (at < 0) return;
    const tok = new state.Token("html_block", "", 0);
    tok.content = `<PageTools :hoods="${hoods}" />\n`;
    state.tokens.splice(at + 1, 0, tok);
  });
}

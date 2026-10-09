// Puts <CheckYourself> at the end of a page that has questions in quiz.json.
import type MarkdownIt from "markdown-it";
import quiz from "./quiz.json";

export default function checkPlugin(md: MarkdownIt) {
  md.core.ruler.push("check-yourself", (state) => {
    const rel = ((state.env as { relativePath?: string }).relativePath ?? "").replace(/\.md$/, "");
    if (!(quiz.pages as Record<string, unknown>)[rel]) return;
    const tok = new state.Token("html_block", "", 0);
    tok.content = "<CheckYourself />\n";
    state.tokens.push(tok);
  });
}

import DefaultTheme from "vitepress/theme";
import { useData } from "vitepress";
import { h, nextTick, watch } from "vue";
import type { Theme } from "vitepress";
import { useTheme } from "blessing-ui";
import "blessing-ui/style.css";
import "./diagram.css";
import "./custom.css";
import Diagram from "./Diagram.vue";

export default {
  extends: DefaultTheme,
  Layout() {
    // Keep VitePress's dark switch and Blessing's data-theme in step (same approach as ui.blessing.id).
    const { isDark, frontmatter } = useData();
    const bless = useTheme();
    if (typeof window !== "undefined") {
      queueMicrotask(() => {
        let saved: string | null = null;
        try {
          saved = localStorage.getItem("vitepress-theme-appearance");
        } catch {}
        bless.set(saved === "dark" || saved === "light" ? saved : "system");
        watch(isDark, (d) => bless.set(d ? "dark" : "light"));
        watch(bless.isDark, (d) => d !== isDark.value && (isDark.value = d));
      });
    }
    // The home layout has no <main>. Give it one so the page has a main landmark.
    if (typeof window !== "undefined") {
      watch(
        () => frontmatter.value.layout,
        (layout) =>
          nextTick(() => {
            const el = document.getElementById("VPContent");
            if (layout === "home") el?.setAttribute("role", "main");
            else el?.removeAttribute("role");
          }),
        { immediate: true, flush: "post" },
      );
    }
    return h(DefaultTheme.Layout);
  },
  enhanceApp({ app }) {
    app.component("Diagram", Diagram);
  },
} satisfies Theme;

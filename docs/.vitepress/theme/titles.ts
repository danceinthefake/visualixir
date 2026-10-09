// Page path (no leading slash, no .md) to its title in the sidebar.
import { computed } from "vue";
import { useData } from "vitepress";

export function usePageTitles() {
  const { theme } = useData();
  return computed(() => {
    const m = new Map<string, string>();
    const walk = (items: any[]) =>
      items.forEach((i) => {
        // "Process-related" alone says little, away from its sidebar group
        if (i.link) m.set(i.link.replace(/^\//, ""), /-related$/.test(i.text) ? `${i.text} anti-patterns` : i.text);
        else if (i.items) walk(i.items);
      });
    Object.values(theme.value.sidebar ?? {}).forEach((groups: any) => groups.forEach((g: any) => walk(g.items ?? [])));
    return m;
  });
}

<script setup lang="ts">
// Renders nothing. Ticks the sidebar links of pages marked as read (class is-read, styled in custom.css).
import { nextTick, onMounted, watch } from "vue";
import { useData, useRoute } from "vitepress";
import { loadRead, read } from "./read";

const route = useRoute();
const { site } = useData();
const mark = () =>
  nextTick(() =>
    document.querySelectorAll<HTMLAnchorElement>(".VPSidebar a.link").forEach((a) => {
      const href = (a.getAttribute("href") ?? "").split("#")[0].replace(/\.html$/, "");
      const path = href.slice(site.value.base.length).replace(/\/$/, "");
      a.classList.toggle("is-read", read.pages.includes(path));
    }),
  );
onMounted(() => {
  loadRead();
  mark();
});
watch([() => route.path, () => read.pages.length, () => read.pages.join("|")], mark, { flush: "post" });
</script>

<template><span hidden /></template>

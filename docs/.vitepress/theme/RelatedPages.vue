<script setup lang="ts">
// "Related pages" under the content, from related.json.
import { computed } from "vue";
import { useData, withBase } from "vitepress";
import related from "../related.json";
import { usePageTitles } from "./titles";

const { page } = useData();
const titles = usePageTitles();
const list = computed(() =>
  ((related.pages as Record<string, { related?: string[] }>)[page.value.relativePath.replace(/\.md$/, "")]?.related ?? []).filter((p) => titles.value.has(p)),
);
</script>

<template>
  <nav v-if="list.length" class="related-pages" aria-labelledby="related-pages-title">
    <h2 id="related-pages-title">Related pages</h2>
    <ul>
      <li v-for="p in list" :key="p"><a :href="withBase('/' + p)">{{ titles.get(p) }}</a></li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
// Under the title of a page: what to read first, and controls for its "Under the hood" sections.
// Inserted by page-tools-plugin.ts; related.json says what to read first and what else covers the same ground.
import { computed } from "vue";
import { useData, withBase } from "vitepress";
import related from "../related.json";
import { usePageTitles } from "./titles";
import { hood, setAlways, setAll } from "./hood";

withDefaults(defineProps<{ hoods?: number }>(), { hoods: 0 });
const { page } = useData();

const titles = usePageTitles();
const entry = computed(() => (related.pages as Record<string, { first?: string[] }>)[page.value.relativePath.replace(/\.md$/, "")]);
const first = computed(() => (entry.value?.first ?? []).filter((p) => titles.value.has(p)));
</script>

<template>
  <div v-if="first.length || hoods >= 2" class="page-tools">
    <p v-if="first.length" class="page-tools__first">
      <strong>Read first:</strong>
      <template v-for="(p, i) in first" :key="p"><template v-if="i">, </template><a :href="withBase('/' + p)">{{ titles.get(p) }}</a></template>
    </p>
    <div v-if="hoods >= 2" class="page-tools__hood" role="group" aria-label="Under the hood sections">
      <span>{{ hoods }} “Under the hood” {{ hoods === 1 ? "section" : "sections" }} on this page</span>
      <button type="button" @click="setAll(true)">Open all</button>
      <button type="button" @click="setAll(false)">Close all</button>
      <label><input type="checkbox" :checked="hood.always" @change="setAlways(($event.target as HTMLInputElement).checked)" /> Always open them</label>
    </div>
  </div>
</template>

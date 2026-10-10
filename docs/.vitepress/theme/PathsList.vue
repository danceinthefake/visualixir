<script setup lang="ts">
// The /paths page: tracks of pages, with the reader's progress and a Continue link.
import { computed, onMounted } from "vue";
import { withBase } from "vitepress";
import paths from "../paths.json";
import { isRead, loadRead, read, resetRead } from "./read";
import { usePageTitles } from "./titles";

const titles = usePageTitles();
onMounted(loadRead);
const tracks = computed(() =>
  paths.tracks.map((t) => {
    const done = t.steps.filter((s) => read.pages.includes(s)).length;
    const next = t.steps.find((s) => !read.pages.includes(s));
    return { ...t, done, next };
  }),
);
const any = computed(() => read.pages.length > 0);
</script>

<template>
  <div class="paths">
    <section v-for="t in tracks" :key="t.id" class="paths__track" :aria-labelledby="`path-${t.id}`">
      <h2 :id="`path-${t.id}`">{{ t.title }}</h2>
      <p class="paths__blurb">{{ t.blurb }}</p>
      <p class="paths__progress">
        <span class="paths__count">{{ t.done }} of {{ t.steps.length }} read</span>
        <a v-if="t.next && t.done" :href="withBase('/' + t.next)" class="paths__continue">Continue: {{ titles.get(t.next) }}</a>
        <a v-else-if="t.next" :href="withBase('/' + t.next)" class="paths__continue">Start: {{ titles.get(t.next) }}</a>
        <span v-else class="paths__continue">Finished</span>
      </p>
      <ol class="paths__steps">
        <li v-for="s in t.steps" :key="s" :class="{ 'is-read': isRead(s) }">
          <a :href="withBase('/' + s)">{{ titles.get(s) ?? s }}</a><span v-if="isRead(s)" class="paths__tick"> ✓<span class="sr-only"> (read)</span></span>
        </li>
      </ol>
    </section>
    <p v-if="any" class="paths__reset"><button type="button" @click="resetRead()">Clear my progress</button></p>
  </div>
</template>

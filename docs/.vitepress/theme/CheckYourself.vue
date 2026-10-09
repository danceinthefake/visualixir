<script setup lang="ts">
// "Check yourself" at the end of a page: questions from quiz.json, each with its answer behind a button.
// Inserted by check-plugin.ts. The answers rest on the official docs (scripts/audit.py checks the sentence they come from).
import { computed } from "vue";
import { useData } from "vitepress";
import quiz from "../quiz.json";

const { page } = useData();
const items = computed(() => (quiz.pages as Record<string, { q: string; a: string }[]>)[page.value.relativePath.replace(/\.md$/, "")] ?? []);
// `code` in a question or answer
const parts = (t: string) => t.split("`").map((text, i) => ({ text, code: i % 2 === 1 }));
</script>

<template>
  <section v-if="items.length" class="check" aria-labelledby="check-title">
    <h2 id="check-title">Check yourself</h2>
    <p class="check__intro">Answer in your head first, then open the answer.</p>
    <ol class="check__list">
      <li v-for="(it, i) in items" :key="i">
        <details class="check__item">
          <summary><template v-for="(p, j) in parts(it.q)" :key="j"><code v-if="p.code">{{ p.text }}</code><template v-else>{{ p.text }}</template></template></summary>
          <p class="check__answer"><template v-for="(p, j) in parts(it.a)" :key="j"><code v-if="p.code">{{ p.text }}</code><template v-else>{{ p.text }}</template></template></p>
        </details>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
// The /glossary page: every term with its definition and where it is explained.
import { computed } from "vue";
import { withBase } from "vitepress";
import glossary from "../glossary.json";

const terms = computed(() => [...glossary.terms].sort((a, b) => a.term.localeCompare(b.term)));
const parts = (d: string) => d.split("`").map((text, i) => ({ text, code: i % 2 === 1 }));
</script>

<template>
  <dl class="glossary">
    <div v-for="t in terms" :key="t.id" class="glossary__item">
      <dt :id="t.id"><a class="header-anchor" :href="`#${t.id}`" :aria-label="`Link to ${t.term}`">#</a>{{ t.term }}</dt>
      <dd>
        <template v-for="(p, i) in parts(t.definition)" :key="i"><code v-if="p.code">{{ p.text }}</code><template v-else>{{ p.text }}</template></template>
        <a :href="withBase(t.page)" class="glossary__more">Read the page</a>
      </dd>
    </div>
  </dl>
</template>

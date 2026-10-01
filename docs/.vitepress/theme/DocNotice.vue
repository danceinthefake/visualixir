<script setup lang="ts">
// Shown under every page derived from an official chapter: when it was taken, and where the original lives.
import { computed } from "vue";
import { useData } from "vitepress";

const { page, theme } = useData();
const snap = computed(() => theme.value.snapshot as { date: string; elixir?: string } | undefined);
const slug = computed(() => page.value.relativePath.replace(/\.md$/, "").split("/").pop());
const url = computed(() => `https://elixir.hexdocs.pm/${slug.value}.html`);
</script>

<template>
  <p v-if="snap" class="doc-notice">
    A condensed, illustrated version of the
    <a :href="url" rel="noopener">official Elixir page</a>, taken from the docs of
    <time :datetime="snap.date">{{ snap.date }}</time><template v-if="snap.elixir"> (Elixir {{ snap.elixir }})</template>.
    The official page is authoritative.
  </p>
</template>

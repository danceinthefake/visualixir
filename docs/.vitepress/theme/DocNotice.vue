<script setup lang="ts">
// Shown under every page derived from an official chapter: when it was taken, and where the original lives.
import { computed } from "vue";
import { useData } from "vitepress";

const { page, theme, frontmatter } = useData();
const snap = computed(() => theme.value.snapshot as { date: string; elixir?: string } | undefined);
const slug = computed(() => page.value.relativePath.replace(/\.md$/, "").split("/").pop());
// module pages say where their docs are in the front matter; guide chapters live at <slug>.html
const url = computed(() => (frontmatter.value.source as string | undefined) ?? `https://elixir.hexdocs.pm/${slug.value}.html`);
</script>

<template>
  <p v-if="snap && frontmatter.notice !== false" class="doc-notice">
    This page is a short version of the
    <a :href="url" rel="noopener">official Elixir page</a>, with diagrams. It uses the docs of
    <time :datetime="snap.date">{{ snap.date }}</time><template v-if="snap.elixir"> (Elixir {{ snap.elixir }})</template>.
    The official page is the reference.
  </p>
</template>

<script setup lang="ts">
// <Diagram name="pattern-matching/tuple" caption="..." /> inlines diagrams/<name>.svg
// so diagram.css can repaint it from theme tokens (an <img> would be out of CSS reach).
import { computed } from "vue";

const svgs = import.meta.glob("../../diagrams/**/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const props = defineProps<{ name: string; caption?: string }>();
const svg = computed(() => svgs[`../../diagrams/${props.name}.svg`] ?? `Missing diagram: ${props.name}`);
</script>

<template>
  <figure class="diagram">
    <div v-html="svg" />
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

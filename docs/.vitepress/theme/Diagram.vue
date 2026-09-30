<script setup lang="ts">
// <Diagram name="pattern-matching/tuple" caption="..." /> inlines diagrams/<name>.svg
// so diagram.css can repaint it from theme tokens (an <img> would be out of CSS reach).
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const svgs = import.meta.glob("../../diagrams/**/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const props = defineProps<{ name: string; caption?: string }>();
const svg = computed(() => svgs[`../../diagrams/${props.name}.svg`] ?? `Missing diagram: ${props.name}`);

// On phones a wide diagram scrolls sideways; fade the edge that still has more to show.
const box = ref<HTMLElement>();
const more = ref({ left: false, right: false });
const measure = () => {
  const el = box.value;
  if (!el) return;
  more.value = {
    left: el.scrollLeft > 4,
    right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
  };
};
let ro: ResizeObserver | undefined;
onMounted(() => {
  measure();
  ro = new ResizeObserver(measure);
  if (box.value) ro.observe(box.value);
});
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <figure class="diagram">
    <div
      ref="box"
      :class="{ 'more-left': more.left, 'more-right': more.right }"
      @scroll.passive="measure"
      v-html="svg"
    />
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

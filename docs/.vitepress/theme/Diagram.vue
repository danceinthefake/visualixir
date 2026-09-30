<script setup lang="ts">
// <Diagram name="pattern-matching/tuple" caption="..." /> inlines diagrams/<name>.svg
// so diagram.css can repaint it from theme tokens (an <img> would be out of CSS reach).
import { computed, onBeforeUnmount, onMounted, ref, useId } from "vue";

const svgs = import.meta.glob("../../diagrams/**/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const props = defineProps<{ name: string; caption?: string }>();
const raw = computed(() => svgs[`../../diagrams/${props.name}.svg`] ?? `Missing diagram: ${props.name}`);

// Graphviz output carries an XML prolog, a DOCTYPE, comments and a <title> per node and edge
// (ids like "p3->v3"). None of that belongs in an HTML page or a screen reader's ear.
const svg = computed(() =>
  raw.value
    .replace(/<\?xml[^>]*\?>/, "")
    .replace(/<!DOCTYPE[^>]*>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace("<svg ", '<svg aria-hidden="true" focusable="false" '),
);

// The diagram is one image with the caption as its name. Its labels, in drawing order, are its description.
const entities: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#160;": " " };
const labels = computed(() =>
  [...raw.value.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) =>
      m[1]
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&(lt|gt|amp|quot);/g, (e) => entities[e]),
    )
    .filter((t) => t.trim())
    .join(" · "),
);

const id = useId();
const capId = `${id}-cap`;
const descId = `${id}-desc`;

// On phones a wide diagram scrolls sideways: fade the edge that still has more to show,
// and make the scrolling area reachable from the keyboard.
const box = ref<HTMLElement>();
const more = ref({ left: false, right: false });
const scrollable = ref(false);
const measure = () => {
  const el = box.value;
  if (!el) return;
  scrollable.value = el.scrollWidth > el.clientWidth;
  more.value = {
    left: el.scrollLeft > 4,
    right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
  };
};
let ro: ResizeObserver | undefined;
onMounted(() => {
  measure();
  ro = new ResizeObserver(measure);
  if (box.value) {
    ro.observe(box.value);
    // the svg itself changes size when the phone zoom rule applies, without the box resizing
    if (box.value.firstElementChild) ro.observe(box.value.firstElementChild);
  }
});
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <figure class="diagram">
    <div
      ref="box"
      role="img"
      :aria-labelledby="caption ? capId : undefined"
      :aria-label="caption ? undefined : 'Diagram'"
      :aria-describedby="labels ? descId : undefined"
      :tabindex="scrollable ? 0 : undefined"
      :class="{ 'more-left': more.left, 'more-right': more.right }"
      @scroll.passive="measure"
      v-html="svg"
    />
    <span v-if="labels" :id="descId" hidden>{{ labels }}</span>
    <figcaption v-if="caption" :id="capId">{{ caption }}</figcaption>
  </figure>
</template>

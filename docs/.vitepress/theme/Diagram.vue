<script setup lang="ts">
// <Diagram name="pattern-matching/tuple" caption="..." /> inlines diagrams/<name>.svg
// so diagram.css can repaint it from theme tokens (an <img> would be out of CSS reach).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from "vue";

const svgs = import.meta.glob("../../diagrams/**/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const props = defineProps<{ name: string; caption?: string; steps?: boolean }>();
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

// --- Step through: <Diagram steps /> lights up arrows one at a time. Graphviz does not keep the order edges are declared in,
// so the .dot file numbers the ones that take part: edge [id=step1], edge [id=step2], ... The description of a step is the
// arrow's label, or "from → to" when it has none.
const decode = (t: string) =>
  t
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&(lt|gt|amp|quot);/g, (e) => entities[e]);
const textsOf = (g: string) => [...g.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((t) => decode(t[1]).trim()).filter(Boolean);
const stepText = computed(() => {
  const nodes = new Map<string, string>();
  for (const m of raw.value.matchAll(/<g id="node\d+" class="node[^"]*">\s*<title>([\s\S]*?)<\/title>([\s\S]*?)<\/g>/g))
    nodes.set(decode(m[1]), textsOf(m[2]).join(" "));
  const found: [number, string][] = [];
  for (const m of raw.value.matchAll(/<g id="step(\d+)" class="edge[^"]*">([\s\S]*?)<\/g>/g)) {
    const texts = textsOf(m[2]);
    const ends = decode(m[2].match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").split("->");
    found.push([Number(m[1]), texts.length ? texts.join(" ") : ends.map((n) => nodes.get(n) ?? n).join(" → ")]);
  }
  return found.sort((x, y) => x[0] - y[0]).map((f) => f[1]);
});
const step = ref(0);
const total = computed(() => stepText.value.length);
const showStep = (n: number) => {
  step.value = Math.max(0, Math.min(total.value, n));
  box.value?.classList.toggle("is-stepping", step.value > 0);
  for (let i = 1; i <= total.value; i++) {
    const e = box.value?.querySelector(`#step${i}`);
    e?.classList.toggle("step-seen", i < step.value);
    e?.classList.toggle("step-now", i === step.value);
  }
};

// --- Enlarge: the same drawing in a dialog, with zoom. Esc closes it (native <dialog>).
const dlg = ref<HTMLDialogElement>();
const body = ref<HTMLElement>();
const zoomed = ref("");
const zoom = ref(0); // 0 = fit the window, otherwise a multiple of the natural size
const fit = () => body.value?.querySelector("svg")?.removeAttribute("style");
const applyZoom = () => {
  const el = body.value?.querySelector("svg");
  if (!el) return;
  if (!zoom.value) return fit();
  const w = parseFloat(el.getAttribute("viewBox")?.split(/\s+/)[2] ?? "0") || el.getBoundingClientRect().width;
  el.style.maxWidth = "none";
  el.style.width = `${Math.round(w * (96 / 72) * zoom.value)}px`;
};
const opener = ref<HTMLElement>();
const enlarge = async (e: Event) => {
  opener.value = e.currentTarget as HTMLElement;
  zoomed.value = box.value?.innerHTML ?? "";
  zoom.value = window.innerWidth < 640 ? 1 : 0; // phones start at natural size and scroll
  dlg.value?.showModal();
  await nextTick();
  applyZoom();
};
const zoomBy = async (f: number) => {
  zoom.value = f === 0 ? 0 : Math.min(4, Math.max(0.5, Math.round((zoom.value || 1) * f * 100) / 100));
  await nextTick();
  applyZoom();
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
  <figure class="diagram" :class="{ 'diagram--steps': steps }">
    <button type="button" class="diagram__enlarge" :aria-label="`Enlarge diagram${caption ? ': ' + caption : ''}`" @click="enlarge">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6" />
      </svg>
    </button>
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
    <div v-if="steps && total" class="diagram__steps">
      <button type="button" :disabled="step === 0" @click="showStep(step - 1)">Back</button>
      <button type="button" :disabled="step >= total" @click="showStep(step + 1)">{{ step === 0 ? "Step through" : "Next step" }}</button>
      <button type="button" :disabled="step === 0" @click="showStep(0)">Reset</button>
      <p class="diagram__step" role="status" aria-live="polite">
        <template v-if="step === 0">{{ total }} steps</template>
        <template v-else><strong>Step {{ step }} of {{ total }}:</strong> {{ stepText[step - 1] }}</template>
      </p>
    </div>
    <figcaption v-if="caption" :id="capId">{{ caption }}</figcaption>
    <dialog ref="dlg" class="diagram-dialog" :aria-label="caption ? `Enlarged diagram: ${caption}` : 'Enlarged diagram'" @close="opener?.focus()">
      <div class="diagram-dialog__bar">
        <button type="button" aria-label="Zoom out" @click="zoomBy(1 / 1.25)">−</button>
        <button type="button" aria-label="Zoom in" @click="zoomBy(1.25)">+</button>
        <button type="button" @click="zoomBy(0)">Fit</button>
        <button type="button" class="diagram-dialog__close" @click="dlg?.close()">Close</button>
      </div>
      <div ref="body" class="diagram-dialog__body" tabindex="0" role="img" :aria-label="caption || 'Diagram'" v-html="zoomed" />
    </dialog>
  </figure>
</template>

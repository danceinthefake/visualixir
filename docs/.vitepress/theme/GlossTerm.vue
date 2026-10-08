<script setup lang="ts">
// <GlossTerm id="mailbox">mailbox</GlossTerm>: a word with a hover card. Added by glossary-plugin.ts to the first mention of a
// term on each page. Hover (mouse), focus or tap opens the card, Esc or a tap elsewhere closes it (native popover).
import { computed, ref, useId } from "vue";
import { withBase } from "vitepress";
import glossary from "../glossary.json";

const props = defineProps<{ id: string }>();
const term = computed(() => glossary.terms.find((t) => t.id === props.id));
const uid = useId();
const cardId = `${uid}-gloss`;
const btn = ref<HTMLButtonElement>();
const card = ref<HTMLElement>();
const open = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let byHover = false;

// the definition may have `code`
const parts = computed(() => (term.value?.definition ?? "").split("`").map((text, i) => ({ text, code: i % 2 === 1 })));

const place = () => {
  const b = btn.value?.getBoundingClientRect();
  const c = card.value;
  if (!b || !c) return;
  const w = c.offsetWidth;
  const left = Math.max(8, Math.min(b.left, window.innerWidth - w - 8));
  const below = b.bottom + 6 + c.offsetHeight < window.innerHeight || b.top < c.offsetHeight + 12;
  c.style.left = `${left}px`;
  c.style.top = `${below ? b.bottom + 6 : b.top - c.offsetHeight - 6}px`;
};
const show = () => {
  clearTimeout(timer);
  if (!card.value?.showPopover || open.value) return;
  card.value.showPopover();
};
const hide = () => {
  clearTimeout(timer);
  if (card.value?.hidePopover && open.value) card.value.hidePopover();
};
const onToggle = (e: Event) => {
  open.value = (e as ToggleEvent).newState === "open";
  if (open.value) place();
  else byHover = false;
};
const onClick = () => {
  if (open.value && byHover) byHover = false; // the card was opened by hovering: a click keeps it
  else if (open.value) hide();
  else show();
};
const enter = (e: PointerEvent) => {
  if (e.pointerType !== "mouse") return;
  clearTimeout(timer);
  timer = setTimeout(() => { byHover = true; show(); }, 250);
};
const leave = (e: PointerEvent) => {
  if (e.pointerType !== "mouse") return;
  clearTimeout(timer);
  if (byHover) timer = setTimeout(hide, 250);
  else clearTimeout(timer);
};
</script>

<template>
  <span v-if="term" class="gloss">
    <button
      ref="btn"
      type="button"
      class="gloss__term"
      :aria-expanded="open"
      :aria-controls="cardId"
      @click="onClick"
      @pointerenter="enter"
      @pointerleave="leave"
    ><slot /></button>
    <span :id="cardId" ref="card" popover="auto" class="gloss__card" role="note" @toggle="onToggle" @pointerenter="clearTimeout(timer)" @pointerleave="leave">
      <strong class="gloss__name">{{ term.term }}</strong>
      <span class="gloss__def"><template v-for="(p, i) in parts" :key="i"><code v-if="p.code">{{ p.text }}</code><template v-else>{{ p.text }}</template></template></span>
      <span class="gloss__links"><a :href="withBase(term.page)">Read the page</a> · <a :href="withBase(`/glossary#${term.id}`)">Glossary</a></span>
    </span>
  </span>
  <slot v-else />
</template>

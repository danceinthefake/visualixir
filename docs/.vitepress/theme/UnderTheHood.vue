<script setup lang="ts">
// <UnderTheHood> ... </UnderTheHood>: an optional, collapsed explanation of what a construct does in memory, on the CPU or
// on storage. It is Visualixir's own text, not derived from the official docs, and says so in the title.
// Closed unless the reader asked otherwise (PageTools: Open all, or "always open").
import { BlessCollapsible } from "blessing-ui";
import { onMounted, ref, watch } from "vue";
import { hood, loadHood } from "./hood";

const open = ref(false);
onMounted(() => {
  loadHood();
  if (hood.always) open.value = true;
});
watch(() => hood.version, () => (open.value = hood.target));
</script>

<template>
  <BlessCollapsible v-model:open="open" class="under-the-hood">
    <template #title>
      Under the hood
      <small class="under-the-hood__note">Visualixir's explanation, not from the official docs</small>
    </template>
    <slot />
  </BlessCollapsible>
</template>

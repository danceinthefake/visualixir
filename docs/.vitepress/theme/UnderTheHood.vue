<script setup lang="ts">
// <UnderTheHood> ... </UnderTheHood>: an optional, collapsed explanation of what a construct does in memory, on the CPU or
// on storage. It is Visualixir's own text, not derived from the official docs, and says so in the title.
import { BlessCollapsible } from "blessing-ui";
</script>

<template>
  <BlessCollapsible class="under-the-hood">
    <template #title>
      Under the hood
      <small class="under-the-hood__note">Visualixir's explanation, not from the official docs</small>
    </template>
    <slot />
  </BlessCollapsible>
</template>

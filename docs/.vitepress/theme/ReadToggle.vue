<script setup lang="ts">
// "Mark as read" at the end of a page. Progress shows as a tick in the sidebar and on /paths. Kept in this browser only.
import { computed, onMounted } from "vue";
import { useData, withBase } from "vitepress";
import { isRead, loadRead, setRead } from "./read";

const { page, frontmatter } = useData();
const path = computed(() => page.value.relativePath.replace(/\.md$/, ""));
const show = computed(() => frontmatter.value.notice !== false && frontmatter.value.layout !== "home");
onMounted(loadRead);
</script>

<template>
  <div v-if="show" class="read-toggle">
    <button type="button" :aria-pressed="isRead(path)" @click="setRead(path, !isRead(path))">
      {{ isRead(path) ? "✓ Marked as read" : "Mark as read" }}
    </button>
    <a :href="withBase('/paths')" class="read-toggle__paths">See your reading paths</a>
  </div>
</template>

<script setup lang="ts">
defineProps<{ tip: string }>();
</script>

<template>
  <span class="info-tip" :title="tip" tabindex="0" role="tooltip">i</span>
</template>

<style scoped>
.info-tip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%; font-size: 10px; font-weight: 500;
  background: var(--border); color: var(--text2); cursor: help; font-style: italic;
  line-height: 1; vertical-align: middle; margin-left: 2px;
}
.info-tip:hover { background: var(--text2); color: var(--card); }
</style>

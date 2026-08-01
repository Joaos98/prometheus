<script setup lang="ts">
defineProps<{ title: string; empty?: string }>()
</script>

<template>
  <section class="card panel">
    <header>
      <h2 class="section-label">{{ title }}</h2>
      <slot name="header" />
    </header>
    <div class="rows">
      <slot>
        <p class="muted empty">{{ empty }}</p>
      </slot>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--row-gap);
}

.empty {
  margin: 0;
  font-size: 13px;
}
</style>

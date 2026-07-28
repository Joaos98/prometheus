<script setup lang="ts">
defineProps<{ page: string }>();
defineEmits<{ navigate: [page: string] }>();
</script>

<template>
  <aside class="sidebar">
    <div class="brand">Prometheus</div>
    <nav>
      <button :class="{ active: page === 'overview' }" @click="$emit('navigate', 'overview')">Overview</button>
      <button :class="{ active: page === 'income' }" @click="$emit('navigate', 'income')">Income</button>
      <button :class="{ active: page === 'expenses' }" @click="$emit('navigate', 'expenses')">Expenses</button>
      <button :class="{ active: page === 'goals' }" @click="$emit('navigate', 'goals')">Goals</button>
    </nav>
  </aside>
</template>

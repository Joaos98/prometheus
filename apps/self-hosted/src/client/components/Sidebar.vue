<script setup lang="ts">
defineProps<{ page: string }>();
defineEmits<{ navigate: [page: string] }>();
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="planet-mark"><div></div></div>
      <span>Prometheus</span>
    </div>
    <nav class="sidebar-nav">
      <button :class="{ active: page === 'overview' }" @click="$emit('navigate', 'overview')"><span class="nav-dot">●</span> Overview</button>
      <button :class="{ active: page === 'income' }" @click="$emit('navigate', 'income')"><span class="nav-dot">●</span> Income</button>
      <button :class="{ active: page === 'expenses' }" @click="$emit('navigate', 'expenses')"><span class="nav-dot">●</span> Expenses</button>
      <button :class="{ active: page === 'goals' }" @click="$emit('navigate', 'goals')"><span class="nav-dot">●</span> Goals</button>
      <button :class="{ active: page === 'members' }" @click="$emit('navigate', 'members')"><span class="nav-dot">●</span> Members</button>
    </nav>
  </aside>
</template>

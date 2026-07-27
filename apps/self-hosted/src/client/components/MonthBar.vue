<script setup lang="ts">
defineProps<{
  displayMonth: string;
  monthLabel: string;
  jumpMonth: string;
  pendingCount: number;
}>();
defineEmits<{
  prev: [];
  next: [];
  today: [];
  jump: [];
  'update:jumpMonth': [v: string];
}>();
</script>

<template>
  <header class="month-bar">
    <div class="month-pill">
      <button @click="$emit('prev')" class="chevron">&lsaquo;</button>
      <span class="month-label" @click="$emit('today')">&#x1F4C5; {{ monthLabel }}</span>
      <button @click="$emit('next')" class="chevron">&rsaquo;</button>
    </div>
    <button @click="$emit('today')" class="today-btn">Today</button>
    <span class="bar-divider"></span>
    <div class="jump-wrap">
      <span class="jump-icon">&#x1F50D;</span>
      <input :value="jumpMonth" @input="$emit('update:jumpMonth', ($event.target as HTMLInputElement).value)" @keydown.enter="$emit('jump')" placeholder="Jump to YYYY-MM" class="jump-input" />
    </div>
    <span class="bar-spacer"></span>
    <span v-if="pendingCount > 0" class="pending-badge">&#x1F6A9; {{ pendingCount }} pending</span>
  </header>
</template>

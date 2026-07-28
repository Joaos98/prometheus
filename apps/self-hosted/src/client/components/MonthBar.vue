<script setup lang="ts">
defineProps<{ monthLabel: string; jumpMonth: string }>();
defineEmits<{ prev: []; next: []; today: []; jump: []; 'update:jumpMonth': [v: string] }>();
</script>

<template>
  <header class="month-bar">
    <div class="month-pill">
      <button @click="$emit('prev')">&lsaquo;</button>
      <span @click="$emit('today')">{{ monthLabel }}</span>
      <button @click="$emit('next')">&rsaquo;</button>
    </div>
    <button @click="$emit('today')" class="today-btn">Today</button>
    <span class="bar-spacer"></span>
    <input :value="jumpMonth" @input="$emit('update:jumpMonth', ($event.target as HTMLInputElement).value)" @keydown.enter="$emit('jump')" placeholder="YYYY-MM" class="jump-input" />
  </header>
</template>

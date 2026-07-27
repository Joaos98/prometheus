<script setup lang="ts">
import MonthPicker from "./MonthPicker.vue";

defineProps<{
  displayMonth: string;
  monthLabel: string;
  jumpMonth: string;
  pendingExpenses: number;
  pendingContributions: number;
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
      <MonthPicker :modelValue="jumpMonth" @update:modelValue="$emit('update:jumpMonth', $event); $emit('jump')" placeholder="Jump to" />
    </div>
    <span class="bar-spacer"></span>
    <span v-if="pendingExpenses + pendingContributions > 0" class="pending-badge">
      &#x1F6A9; {{ pendingExpenses ? pendingExpenses + ' expense' + (pendingExpenses > 1 ? 's' : '') : '' }}{{ pendingExpenses && pendingContributions ? ', ' : '' }}{{ pendingContributions ? pendingContributions + ' goal' + (pendingContributions > 1 ? 's' : '') : '' }} pending
    </span>
  </header>
</template>

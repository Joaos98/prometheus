<script setup lang="ts">
import { onMounted } from 'vue'
import { useHousehold } from './household.js'
import SetupView from './views/SetupView.vue'
import MonthDashboard from './views/MonthDashboard.vue'

const { household, viewing, loading, failure, load } = useHousehold()

onMounted(load)
</script>

<template>
  <p v-if="loading" class="waiting muted">Opening Prometheus…</p>
  <p v-else-if="failure" class="waiting">{{ failure }}</p>
  <SetupView v-else-if="!household" />
  <MonthDashboard v-else-if="viewing" :household="household" :viewing="viewing" />
  <p v-else class="waiting secondary">This Household holds no opened Month.</p>
</template>

<style scoped>
.waiting {
  padding: 48px;
  text-align: center;
}
</style>

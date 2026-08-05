<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useHousehold } from './household.js'
import { showing } from './view.js'
import SetupView from './views/SetupView.vue'
import MonthDashboard from './views/MonthDashboard.vue'
import TrendsView from './views/TrendsView.vue'

const { household, viewing, loading, failure, load, watchOtherMembers } = useHousehold()

// The other member is editing too. Nothing here pushes or subscribes — the app asks
// again when it is come back to, and lightly while a Month is left open on screen.
let stopWatching: (() => void) | undefined

onMounted(() => {
  stopWatching = watchOtherMembers()
  void load()
})

onUnmounted(() => stopWatching?.())
</script>

<template>
  <p v-if="loading" class="waiting muted">Opening Prometheus…</p>
  <p v-else-if="failure" class="waiting">{{ failure }}</p>
  <SetupView v-else-if="!household" />
  <!-- Trends is its own view rather than a panel: its subject is many Months, and the
       dashboard's three columns are one Month's. -->
  <TrendsView v-else-if="showing === 'trends'" :household="household" />
  <MonthDashboard v-else-if="viewing" :household="household" :viewing="viewing" />
  <p v-else class="waiting secondary">This Household holds no opened Month.</p>
</template>

<style scoped>
.waiting {
  padding: 48px;
  text-align: center;
}
</style>

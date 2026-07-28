<script setup lang="ts">
import type { MonthlySummary } from "@prometheus/engine";
import { onMounted, ref, watch } from "vue";
import { useMonth } from "./composables/useMonth";
import { useApi } from "./composables/useApi";
import Sidebar from "./components/Sidebar.vue";
import MonthBar from "./components/MonthBar.vue";
import OverviewPage from "./pages/OverviewPage.vue";

const month = useMonth();
const api = useApi(month.displayMonth);

const page = ref("overview");
const summary = ref<MonthlySummary | null>(null);
const loading = ref(true);

onMounted(async () => {
  try { summary.value = await api.fetchSummary(); }
  finally { loading.value = false; }
});
watch(month.displayMonth, async () => { summary.value = await api.fetchSummary(month.displayMonth.value); });
</script>

<template>
  <div class="shell">
    <Sidebar :page="page" @navigate="(p) => page = p" />
    <main class="content">
      <p v-if="loading" class="loading">Loading…</p>
      <template v-else-if="summary">
        <MonthBar
          :monthLabel="month.monthLabel.value" :jumpMonth="month.jumpMonth.value"
          @prev="month.prev" @next="month.next" @today="month.today" @jump="month.jump"
          @update:jumpMonth="(v) => month.jumpMonth.value = v" />
        <OverviewPage :summary="summary" />
      </template>
    </main>
  </div>
</template>

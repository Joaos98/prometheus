<script setup lang="ts">
import type { MonthlySummary } from "@prometheus/engine";
import type { ExpenseTemplate, IncomeProfile } from "@prometheus/data";
import { onMounted, ref, watch } from "vue";
import { useMonth } from "./composables/useMonth";
import { useApi } from "./composables/useApi";
import Sidebar from "./components/Sidebar.vue";
import MonthBar from "./components/MonthBar.vue";
import OverviewPage from "./pages/OverviewPage.vue";
import IncomePage from "./pages/IncomePage.vue";
import ExpensesPage from "./pages/ExpensesPage.vue";

const month = useMonth();
const api = useApi(month.displayMonth);

const page = ref("overview");
const summary = ref<MonthlySummary | null>(null);
const members = ref<{ id: string; name: string }[]>([]);
const profiles = ref<IncomeProfile[]>([]);
const templates = ref<ExpenseTemplate[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const hh = await api.fetchHousehold();
    members.value = hh.members;
    profiles.value = hh.incomeProfiles;
    templates.value = hh.expenseTemplates;
    summary.value = await api.fetchSummary();
  } finally { loading.value = false; }
});

watch(month.displayMonth, async () => {
  const hasIncome = summary.value?.members.some(m => m.incomeCents > 0);
  if (!hasIncome && profiles.value.length > 0) await api.snapshotProfile(month.displayMonth.value);
  if (templates.value.length > 0) await api.snapshotExpenses(month.displayMonth.value);
  summary.value = await api.fetchSummary(month.displayMonth.value);
});
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
        <OverviewPage v-if="page === 'overview'" :summary="summary" />
        <IncomePage v-if="page === 'income'" :members="members" :profiles="profiles" :currency="summary.currency" :api="api" />
        <ExpensesPage v-if="page === 'expenses'" :members="members" :templates="templates" :summary="summary" :currency="summary.currency" :displayMonth="month.displayMonth.value" :profiles="profiles" :api="api" />
      </template>
    </main>
  </div>
</template>

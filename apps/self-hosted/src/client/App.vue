<script setup lang="ts">
import type { Goal, MonthlySummary } from "@prometheus/engine";
import type { ExpenseTemplate, IncomeProfile } from "@prometheus/data";
import { onMounted, ref, watch } from "vue";
import { useMonth } from "./composables/useMonth";
import { useApi } from "./composables/useApi";
import Sidebar from "./components/Sidebar.vue";
import MonthBar from "./components/MonthBar.vue";
import OverviewPage from "./pages/OverviewPage.vue";
import IncomePage from "./pages/IncomePage.vue";
import ExpensesPage from "./pages/ExpensesPage.vue";
import GoalsPage from "./pages/GoalsPage.vue";
import MembersPage from "./pages/MembersPage.vue";

const month = useMonth();
const api = useApi(month.displayMonth);

const page = ref("overview");
const currency = ref<string | null>(null);
const summary = ref<MonthlySummary | null>(null);
const members = ref<{ id: string; name: string; joinedFrom?: string; departedFrom?: string }[]>([]);
const profiles = ref<IncomeProfile[]>([]);
const templates = ref<ExpenseTemplate[]>([]);
const goals = ref<Goal[]>([]);
const loading = ref(true);
const currencyValue = ref("USD");
const currencies = [
  "USD", "EUR", "GBP", "BRL", "CAD", "AUD", "JPY", "CHF", "MXN", "ARS",
  "CLP", "COP", "INR", "CNY", "KRW", "NZD", "SEK", "NOK", "DKK", "PLN",
];

async function submitCurrency() {
  await api.setCurrency(currencyValue.value);
  const hh = await api.fetchHousehold();
  currency.value = hh.currency;
  members.value = hh.members;
  profiles.value = hh.incomeProfiles;
  templates.value = hh.expenseTemplates;
  goals.value = hh.goals;
  summary.value = await api.fetchSummary();
}

onMounted(async () => {
  try {
    const hh = await api.fetchHousehold();
    members.value = hh.members;
    profiles.value = hh.incomeProfiles;
    templates.value = hh.expenseTemplates;
    goals.value = hh.goals;
    currency.value = hh.currency;
    if (hh.currency) summary.value = await api.fetchSummary();
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
  <p v-if="loading" class="loading">Loading…</p>

  <div v-else-if="currency === null" class="setup-outer">
    <div class="card setup-card">
      <h2>Welcome to Prometheus</h2>
      <p class="muted">Choose your household currency to get started. This cannot be changed later.</p>
      <form @submit.prevent="submitCurrency" style="display:flex;gap:8px;margin-top:12px">
        <select v-model="currencyValue" class="input">
          <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
        </select>
        <button type="submit" class="btn-accent">Set Currency</button>
      </form>
    </div>
  </div>

  <div class="shell" v-else>
    <Sidebar :page="page" @navigate="(p) => page = p" />
    <main class="content">
      <template v-if="summary">
        <MonthBar
          :monthLabel="month.monthLabel.value" :jumpMonth="month.jumpMonth.value"
          @prev="month.prev" @next="month.next" @today="month.today" @jump="month.jump"
          @update:jumpMonth="(v) => month.jumpMonth.value = v" />
        <OverviewPage v-if="page === 'overview'" :summary="summary" />
        <IncomePage v-if="page === 'income'" :members="members" :profiles="profiles" :currency="summary.currency" :api="api" />
        <ExpensesPage v-if="page === 'expenses'" :members="members" :templates="templates" :summary="summary" :currency="summary.currency" :displayMonth="month.displayMonth.value" :profiles="profiles" :api="api" />
        <GoalsPage v-if="page === 'goals'" :members="members" :goals="goals" :summary="summary" :currency="summary.currency" :displayMonth="month.displayMonth.value" :api="api" />
        <MembersPage v-if="page === 'members'" :members="members" :api="api" />
      </template>
    </main>
  </div>
</template>

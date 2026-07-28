<script setup lang="ts">
import type { Expense, ExpenseAmount, IncomeSource, Member, MonthlySummary, SavingsGoal, SubItemAmount } from "@prometheus/engine";
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
import "./style.css";

const page = ref<"overview" | "income" | "expenses" | "goals" | "members">("overview");
const loading = ref(true);
const refreshing = ref(false);
const currency = ref<string | null>(null);
const members = ref<Member[]>([]);
const incomeSources = ref<IncomeSource[]>([]);
const expenses = ref<Expense[]>([]);
const expenseAmounts = ref<ExpenseAmount[]>([]);
const subItemAmounts = ref<SubItemAmount[]>([]);
const goals = ref<SavingsGoal[]>([]);
const summary = ref<MonthlySummary | null>(null);
const appError = ref<string | null>(null);
const currencyValue = ref("USD");

const month = useMonth();
const api = useApi({ currency, members, incomeSources, expenses, expenseAmounts, subItemAmounts, goals, summary, appError, displayMonth: month.displayMonth });

const formatCurrency = (cents: number, curr: string) => new Intl.NumberFormat(undefined, { style: "currency", currency: curr }).format(cents / 100);
function goalProgressPercent(gp: { accumulatedCents: number; targetAmountCents?: number }) { if (!gp.targetAmountCents || gp.targetAmountCents === 0) return 0; return Math.min(100, Math.round((gp.accumulatedCents / gp.targetAmountCents) * 100)); }
function memberName(id: string) { return members.value.find(m => m.id === id)?.name ?? id; }

const refreshSummary = async () => { refreshing.value = true; try { await api.refreshSummary(); } finally { refreshing.value = false; } };
onMounted(async () => { try { await api.loadHousehold(); if (currency.value) await refreshSummary(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } finally { loading.value = false; } });
watch(month.displayMonth, () => refreshSummary());
</script>

<template>
  <div class="shell" v-if="currency !== null">
    <Sidebar :page="page" @navigate="(p) => page = p as any" />
    <main class="content">
      <p v-if="appError" class="error-banner" @click="appError = null">{{ appError }} <span class="error-dismiss">✕</span></p>
      <p v-else-if="loading" class="loading">Loading…</p>
      <template v-else-if="summary">
        <MonthBar
          :displayMonth="month.displayMonth.value" :monthLabel="month.monthLabel.value"
          :jumpMonth="month.jumpMonth.value"
          :pendingExpenses="summary.pendingExpenses.length"
          :pendingContributions="summary.pendingContributions.length"
          @prev="month.prev" @next="month.next" @today="month.today" @jump="month.jump"
          @update:jumpMonth="(v) => month.jumpMonth.value = v" />

        <div v-if="refreshing" class="refreshing-bar">Updating…</div>

        <OverviewPage v-if="page === 'overview'"
          :summary="summary" :members="members" :expenses="expenses" :goals="goals"
          :incomeSources="incomeSources"
          :expenseAmounts="expenseAmounts" :displayMonth="month.displayMonth.value"
          :goalProgressPercent="goalProgressPercent" :memberName="memberName" :formatCurrency="formatCurrency" />

        <IncomePage v-if="page === 'income'"
          :members="members" :incomeSources="incomeSources" :currency="summary.currency"
          :displayMonth="month.displayMonth.value" :currentMonth="month.currentMonth()" :api="api" />

        <ExpensesPage v-if="page === 'expenses'"
          :members="members" :expenses="expenses" :currency="summary.currency"
          :displayMonth="month.displayMonth.value" :currentMonth="month.currentMonth()"
          :expenseAmounts="expenseAmounts" :subItemAmounts="subItemAmounts" :summaryMembers="summary.members"
          :backdateWarning="month.backdateWarning" :formatCurrency="formatCurrency" :api="api" />

        <GoalsPage v-if="page === 'goals'"
          :members="members" :goals="goals" :currency="summary.currency"
          :displayMonth="month.displayMonth.value" :currentMonth="month.currentMonth()"
          :goalProgress="summary.goalProgress" :pendingContributions="summary.pendingContributions" :api="api" />

        <MembersPage v-if="page === 'members'"
          :members="members" :displayMonth="month.displayMonth.value" :currentMonth="month.currentMonth()" :api="api" />
      </template>
    </main>
  </div>

  <div class="setup-outer" v-else-if="currency === null && !loading">
    <div class="card setup-card">
      <h2>Welcome to Prometheus</h2>
      <p class="muted">Choose your household currency to get started. This cannot be changed later.</p>
      <form @submit.prevent="api.submitCurrency(currencyValue)" style="display:flex;gap:8px;margin-top:12px">
        <input v-model="currencyValue" class="input" />
        <button type="submit" class="btn-accent">Set Currency</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Expense, ExpenseAmount, IncomeSource, Member, MonthlySummary, SavingsGoal } from "@prometheus/engine";
import { computed, onMounted, ref, watch } from "vue";
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
const currency = ref<string | null>(null);
const members = ref<Member[]>([]);
const incomeSources = ref<IncomeSource[]>([]);
const expenses = ref<Expense[]>([]);
const expenseAmounts = ref<ExpenseAmount[]>([]);
const goals = ref<SavingsGoal[]>([]);
const summary = ref<MonthlySummary | null>(null);
const appError = ref<string | null>(null);
const currencyValue = ref("USD");
const householdLeftover = computed(() => (summary.value?.members ?? []).reduce((s, m) => s + m.leftoverCents, 0));

const month = useMonth();
const api = useApi({ currency, members, incomeSources, expenses, expenseAmounts, goals, summary, appError, displayMonth: month.displayMonth });

const formatCurrency = (cents: number, curr: string) => new Intl.NumberFormat(undefined, { style: "currency", currency: curr }).format(cents / 100);
function activeExpenses() { return expenses.value.filter(e => e.effectiveFrom <= month.displayMonth.value && (e.endedFrom === undefined || e.endedFrom > month.displayMonth.value)); }
function expenseHasAmount(eid: string) { return expenseAmounts.value.some(a => a.expenseId === eid && a.month === month.displayMonth.value); }
function expenseAmountCents(eid: string) { return expenseAmounts.value.find(a => a.expenseId === eid && a.month === month.displayMonth.value)?.amountCents; }
function goalProgressPercent(gp: { accumulatedCents: number; targetAmountCents?: number }) { if (!gp.targetAmountCents || gp.targetAmountCents === 0) return 0; return Math.min(100, Math.round((gp.accumulatedCents / gp.targetAmountCents) * 100)); }
function memberName(id: string) { return members.value.find(m => m.id === id)?.name ?? id; }

onMounted(async () => { try { await api.loadHousehold(); if (currency.value) await api.refreshSummary(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } finally { loading.value = false; } });
watch(month.displayMonth, () => api.refreshSummary());
</script>

<template>
  <div class="shell" v-if="currency !== null">
    <Sidebar :page="page" @navigate="(p) => page = p as any" />
    <main class="content">
      <p v-if="appError" class="error-banner">{{ appError }}</p>
      <p v-else-if="loading" class="loading">Loading…</p>
      <template v-else-if="summary">
        <MonthBar
          :displayMonth="month.displayMonth.value" :monthLabel="month.monthLabel.value"
          :jumpMonth="month.jumpMonth.value" :pendingCount="summary.pendingExpenses.length + summary.pendingContributions.length"
          @prev="month.prev" @next="month.next" @today="month.today" @jump="month.jump"
          @update:jumpMonth="(v) => month.jumpMonth.value = v" />

        <OverviewPage v-if="page === 'overview'"
          :summary="summary" :members="members" :expenses="expenses" :goals="goals"
          :activeExpenses="activeExpenses" :expenseHasAmount="expenseHasAmount" :expenseAmountCents="expenseAmountCents"
          :goalProgressPercent="goalProgressPercent" :memberName="memberName" :formatCurrency="formatCurrency"
          :householdLeftover="householdLeftover" />

        <IncomePage v-if="page === 'income'"
          :members="members" :incomeSources="incomeSources" :currency="summary.currency"
          :displayMonth="month.displayMonth.value" :currentMonth="month.currentMonth()" :api="api" />

        <ExpensesPage v-if="page === 'expenses'"
          :members="members" :expenses="expenses" :currency="summary.currency"
          :displayMonth="month.displayMonth.value" :currentMonth="month.currentMonth()"
          :backdateWarning="month.backdateWarning" :formatCurrency="formatCurrency" :api="api" />

        <GoalsPage v-if="page === 'goals'"
          :members="members" :goals="goals" :currency="summary.currency"
          :displayMonth="month.displayMonth.value" :currentMonth="month.currentMonth()"
          :goalProgress="summary.goalProgress" :api="api" />

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

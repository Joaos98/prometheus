<script setup lang="ts">
import type {
  Expense,
  ExpenseAmount,
  IncomeSource,
  Member,
  MonthlySummary,
  SavingsGoal,
} from "@prometheus/engine";
import { onMounted, ref, watch } from "vue";

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

const currency = ref<string | null>(null);
const members = ref<Member[]>([]);
const incomeSources = ref<IncomeSource[]>([]);
const expenses = ref<Expense[]>([]);
const expenseAmounts = ref<ExpenseAmount[]>([]);
const goals = ref<SavingsGoal[]>([]);
const summary = ref<MonthlySummary | null>(null);
const loading = ref(true);
const appError = ref<string | null>(null);

const displayMonth = ref(currentMonth());
const jumpMonth = ref("");

const currencyValue = ref("USD");
const includeRestricted = ref(false);

const newMemberName = ref("");
const newMemberJoinedFrom = ref("");
const editingMemberId = ref<string | null>(null);
const editingMemberName = ref("");
const departingMemberEffFrom = ref<Record<string, string>>({});

const newSourceMemberId = ref("");
const newSourceName = ref("");
const newSourceAmount = ref("");
const newSourceEffectiveFrom = ref("");
const newSourceRestricted = ref(false);
const newSourceOneOff = ref(false);
const editingSourceId = ref<string | null>(null);
const editingSourceAmount = ref("");
const editingSourceEffectiveFrom = ref("");
const endingSourceEffectiveFrom = ref<Record<string, string>>({});

const newExpenseName = ref("");
const newExpenseParticipants = ref<string[]>([]);
const newExpenseSplitRule = ref("even");
const newExpenseCustomMode = ref("percent");
const newExpenseCustomValues = ref<Record<string, number>>({});
const newExpenseOneOff = ref(false);
const newExpenseEffectiveFrom = ref("");
const expenseAmountValues = ref<Record<string, string>>({});
const endingExpenseEffectiveFrom = ref<Record<string, string>>({});
const showChangeSplit = ref<string | null>(null);
const changeSplitRule = ref("even");
const changeSplitEff = ref("");
const showChangeParticipants = ref<string | null>(null);
const changeParticipantsList = ref<string[]>([]);
const changeParticipantsEff = ref("");

const newGoalName = ref("");
const newGoalParticipants = ref<string[]>([]);
const newGoalSplitRule = ref("even");
const newGoalTarget = ref("");
const newGoalEffectiveFrom = ref("");
const goalContributionValues = ref<Record<string, string>>({});
const endingGoalEffectiveFrom = ref<Record<string, string>>({});

const showMemberForm = ref(false);
const showIncomeForm = ref(false);
const showExpenseForm = ref(false);
const showGoalForm = ref(false);

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
}

function goPrev(): void { displayMonth.value = shiftMonth(displayMonth.value, -1); }
function goNext(): void { displayMonth.value = shiftMonth(displayMonth.value, 1); }
function goToMonth(): void {
  const m = jumpMonth.value.trim();
  if (/^\d{4}-\d{2}$/.test(m)) { displayMonth.value = m; jumpMonth.value = ""; }
}

function sourcesForMember(memberId: string): IncomeSource[] {
  return incomeSources.value.filter((s) => s.memberId === memberId);
}

const latestAmount = (source: IncomeSource): number => {
  const sorted = [...source.timeline].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return sorted[0]?.amountCents ?? 0;
};

const formatCurrency = (cents: number, curr: string): string =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: curr }).format(cents / 100);

async function unwrapError(r: Response): Promise<never> {
  const body = (await r.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? `HTTP ${r.status}`);
}

const request = {
  async get(url: string) { const r = await fetch(url); if (!r.ok) await unwrapError(r); return r.json() as unknown; },
  async post(url: string, body: unknown) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) await unwrapError(r);
    return r.json() as unknown;
  },
  async patch(url: string, body: unknown) {
    const r = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) await unwrapError(r);
    return r.json() as unknown;
  },
};

onMounted(async () => {
  try {
    const data = (await request.get("/api/household")) as {
      currency: string | null; members: Member[]; incomeSources: IncomeSource[];
      expenses: Expense[]; expenseAmounts: ExpenseAmount[]; goals: SavingsGoal[];
    };
    currency.value = data.currency;
    members.value = data.members;
    incomeSources.value = data.incomeSources;
    expenses.value = data.expenses;
    expenseAmounts.value = data.expenseAmounts;
    goals.value = data.goals;
    if (currency.value) await refreshSummary();
  } catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
  finally { loading.value = false; }
});

watch(displayMonth, async () => { await refreshSummary(); });

async function refreshSummary(): Promise<void> {
  summary.value = (await request.get(`/api/summary?month=${displayMonth.value}`)) as MonthlySummary;
}

async function loadHouseholdData(): Promise<void> {
  const data = (await request.get("/api/household")) as {
    members: Member[]; incomeSources: IncomeSource[]; expenses: Expense[]; expenseAmounts: ExpenseAmount[]; goals: SavingsGoal[];
  };
  members.value = data.members; incomeSources.value = data.incomeSources;
  expenses.value = data.expenses; expenseAmounts.value = data.expenseAmounts; goals.value = data.goals;
}

function activeExpenses(): Expense[] {
  return expenses.value.filter(e => e.effectiveFrom <= displayMonth.value && (e.endedFrom === undefined || e.endedFrom > displayMonth.value));
}
function expenseHasAmount(expenseId: string): boolean {
  return expenseAmounts.value.some(a => a.expenseId === expenseId && a.month === displayMonth.value);
}
function toggleParticipant(memberId: string): void {
  const idx = newExpenseParticipants.value.indexOf(memberId);
  if (idx >= 0) newExpenseParticipants.value.splice(idx, 1); else newExpenseParticipants.value.push(memberId);
}
function toggleGoalParticipant(memberId: string): void {
  const idx = newGoalParticipants.value.indexOf(memberId);
  if (idx >= 0) newGoalParticipants.value.splice(idx, 1); else newGoalParticipants.value.push(memberId);
}

async function submitCurrency(): Promise<void> {
  try {
    await request.post("/api/household/currency", { currency: currencyValue.value });
    currency.value = currencyValue.value;
    await refreshSummary();
  } catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}

async function submitMember(): Promise<void> {
  const name = newMemberName.value.trim(); if (!name) return;
  try {
    const member = (await request.post("/api/members", { name, joinedFrom: newMemberJoinedFrom.value || undefined })) as Member;
    members.value = [...members.value, member];
    newMemberName.value = ""; newMemberJoinedFrom.value = ""; showMemberForm.value = false;
  } catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
async function departMember(id: string): Promise<void> {
  const eff = departingMemberEffFrom.value[id] ?? currentMonth();
  try { await request.post(`/api/members/${id}/depart`, { effectiveFrom: eff }); delete departingMemberEffFrom.value[id]; await refreshSummary(); }
  catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
function startRename(member: Member): void { editingMemberId.value = member.id; editingMemberName.value = member.name; }
async function commitRename(id: string): Promise<void> {
  const name = editingMemberName.value.trim(); if (!name) return;
  try { await request.patch(`/api/members/${id}`, { name }); members.value = members.value.map(m => m.id === id ? { ...m, name } : m); editingMemberId.value = null; }
  catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
function cancelRename(): void { editingMemberId.value = null; }

async function submitIncomeSource(): Promise<void> {
  const memberId = newSourceMemberId.value; const name = newSourceName.value.trim();
  const amountDollars = parseFloat(newSourceAmount.value); const effectiveFrom = newSourceEffectiveFrom.value;
  if (!memberId || !name || isNaN(amountDollars) || !effectiveFrom) return;
  try {
    const source = (await request.post("/api/income-sources", {
      memberId, name, amountCents: Math.round(amountDollars * 100),
      effectiveFrom, oneOff: newSourceOneOff.value, restrictedUse: newSourceRestricted.value,
    })) as IncomeSource;
    incomeSources.value = [...incomeSources.value, source];
    newSourceName.value = ""; newSourceAmount.value = ""; newSourceEffectiveFrom.value = "";
    newSourceOneOff.value = false; newSourceRestricted.value = false; showIncomeForm.value = false;
  } catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
function startEditSource(source: IncomeSource): void { editingSourceId.value = source.id; editingSourceAmount.value = String(latestAmount(source) / 100); editingSourceEffectiveFrom.value = ""; }
async function commitEditSource(): Promise<void> {
  const id = editingSourceId.value; const amountDollars = parseFloat(editingSourceAmount.value); const effectiveFrom = editingSourceEffectiveFrom.value;
  if (!id || isNaN(amountDollars) || !effectiveFrom) return;
  try { await request.post(`/api/income-sources/${id}/amount`, { amountCents: Math.round(amountDollars * 100), effectiveFrom }); await loadHouseholdData(); editingSourceId.value = null; }
  catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
async function endSource(id: string, effectiveFrom: string): Promise<void> {
  try { await request.post(`/api/income-sources/${id}/end`, { effectiveFrom }); await loadHouseholdData(); }
  catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}

async function submitExpense(): Promise<void> {
  const name = newExpenseName.value.trim(); const participants = [...newExpenseParticipants.value]; const effectiveFrom = newExpenseEffectiveFrom.value;
  if (!name || participants.length === 0 || !effectiveFrom) return;
  try {
    let splitRule: Record<string, unknown>;
    if (newExpenseSplitRule.value === "custom") splitRule = { method: "custom", mode: newExpenseCustomMode.value, values: { ...newExpenseCustomValues.value } };
    else splitRule = { method: newExpenseSplitRule.value };
    const expense = (await request.post("/api/expenses", { name, participants, splitRule, effectiveFrom, oneOff: newExpenseOneOff.value })) as Expense;
    expenses.value = [...expenses.value, expense];
    newExpenseName.value = ""; newExpenseParticipants.value = []; newExpenseCustomValues.value = {};
    newExpenseOneOff.value = false; newExpenseEffectiveFrom.value = ""; showExpenseForm.value = false;
  } catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
async function submitExpenseAmount(expenseId: string): Promise<void> {
  const raw = expenseAmountValues.value[expenseId] ?? ""; const amountDollars = parseFloat(raw); if (isNaN(amountDollars)) return;
  try { await request.post(`/api/expenses/${expenseId}/amount`, { month: displayMonth.value, amountCents: Math.round(amountDollars * 100) }); delete expenseAmountValues.value[expenseId]; await loadHouseholdData(); await refreshSummary(); }
  catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
function endExpense(id: string): void {
  const eff = endingExpenseEffectiveFrom.value[id] ?? currentMonth();
  request.post(`/api/expenses/${id}/end`, { effectiveFrom: eff }).then(async () => { delete endingExpenseEffectiveFrom.value[id]; await loadHouseholdData(); }).catch(e => { appError.value = e instanceof Error ? e.message : String(e); });
}
async function submitChangeSplit(expenseId: string): Promise<void> {
  const eff = changeSplitEff.value.trim(); if (!eff) return;
  try { await request.post(`/api/expenses/${expenseId}/change-split`, { splitRule: { method: changeSplitRule.value }, effectiveFrom: eff }); await loadHouseholdData(); await refreshSummary(); showChangeSplit.value = null; }
  catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
async function submitChangeParticipants(expenseId: string): Promise<void> {
  const eff = changeParticipantsEff.value.trim(); if (!eff) return;
  try { await request.post(`/api/expenses/${expenseId}/change-participants`, { participants: [...changeParticipantsList.value], effectiveFrom: eff }); await loadHouseholdData(); await refreshSummary(); showChangeParticipants.value = null; }
  catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
function backdateWarning(eff: string): string | null {
  if (!eff || eff >= displayMonth.value) return null;
  const [y, m] = eff.split("-").map(Number) as [number, number];
  const [cy, cm] = displayMonth.value.split("-").map(Number) as [number, number];
  return `Will recompute ${(cy - y) * 12 + (cm - m) + 1} months (${eff}–${displayMonth.value})`;
}

async function submitGoal(): Promise<void> {
  const name = newGoalName.value.trim(); const participants = [...newGoalParticipants.value]; const effectiveFrom = newGoalEffectiveFrom.value;
  if (!name || participants.length === 0 || !effectiveFrom) return;
  try {
    await request.post("/api/goals", { name, participants, splitRule: { method: newGoalSplitRule.value }, targetAmountCents: newGoalTarget.value ? Math.round(parseFloat(newGoalTarget.value) * 100) : undefined, effectiveFrom });
    await loadHouseholdData(); newGoalName.value = ""; newGoalParticipants.value = []; newGoalTarget.value = ""; newGoalEffectiveFrom.value = ""; showGoalForm.value = false;
  } catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
async function submitGoalContribution(goalId: string): Promise<void> {
  const raw = goalContributionValues.value[goalId] ?? ""; const amountDollars = parseFloat(raw); if (isNaN(amountDollars)) return;
  try { await request.post(`/api/goals/${goalId}/contribution`, { month: displayMonth.value, amountCents: Math.round(amountDollars * 100) }); delete goalContributionValues.value[goalId]; await loadHouseholdData(); await refreshSummary(); }
  catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
async function endGoal(id: string): Promise<void> {
  const eff = endingGoalEffectiveFrom.value[id] ?? currentMonth();
  try { await request.post(`/api/goals/${id}/end`, { effectiveFrom: eff }); delete endingGoalEffectiveFrom.value[id]; await loadHouseholdData(); }
  catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>Prometheus</h1>
      <span v-if="summary" class="version">Household Finance Tracker</span>
    </header>

    <p v-if="appError" class="error-banner">{{ appError }}</p>
    <p v-else-if="loading" class="loading">Loading…</p>

    <template v-else-if="currency === null">
      <div class="card setup-card">
        <h2>Household Setup</h2>
        <p class="hint">Choose your household currency to get started. This cannot be changed later.</p>
        <form @submit.prevent="submitCurrency" class="inline-form">
          <input v-model="currencyValue" class="input" />
          <button type="submit" class="btn btn-primary">Set Currency</button>
        </form>
      </div>
    </template>

    <template v-else-if="summary">
      <nav class="nav-bar">
        <div class="nav-left">
          <button @click="goPrev" class="btn">&larr;</button>
          <span class="month-label">{{ summary.month }}</span>
          <button @click="goNext" class="btn">&rarr;</button>
          <form @submit.prevent="goToMonth" class="inline-form">
            <input v-model="jumpMonth" placeholder="YYYY-MM" size="7" class="input input-sm" />
            <button type="submit" class="btn btn-small">Go</button>
          </form>
        </div>
        <div class="nav-right">
          <span v-if="summary.pendingExpenses.length > 0" class="badge badge-warn">{{ summary.pendingExpenses.length }} pending</span>
          <span v-if="summary.pendingContributions.length > 0" class="badge badge-warn">{{ summary.pendingContributions.length }} goal pending</span>
          <span v-if="summary.fallbackExpenses.length > 0" class="badge badge-info">{{ summary.fallbackExpenses.length }} proportional fallback</span>
        </div>
      </nav>

      <div class="stats-strip">
        <div class="stat" v-for="member in summary.members" :key="member.memberId">
          <span class="stat-name">{{ member.name }}</span>
          <span :class="['stat-value', member.leftoverCents < 0 ? 'negative' : '']">{{ formatCurrency(member.leftoverCents, summary.currency) }}</span>
        </div>
        <div class="stat stat-toggle">
          <label><input type="checkbox" v-model="includeRestricted" /> Include restricted</label>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="grid-left">
          <section class="card">
            <div class="card-header">
              <h2>Members</h2>
              <button @click="showMemberForm = !showMemberForm" class="btn btn-small">{{ showMemberForm ? 'Cancel' : '+ Add' }}</button>
            </div>
            <form v-if="showMemberForm" @submit.prevent="submitMember" class="add-form">
              <input v-model="newMemberName" placeholder="Member name" class="input" />
              <input v-model="newMemberJoinedFrom" placeholder="From (YYYY-MM)" size="7" class="input input-sm" />
              <button type="submit" class="btn btn-primary btn-small">Save</button>
            </form>
            <ul class="item-list">
              <li v-for="member in members" :key="member.id" class="item-row">
                <template v-if="editingMemberId === member.id">
                  <input v-model="editingMemberName" class="input input-sm" />
                  <button @click="commitRename(member.id)" class="btn btn-small">Save</button>
                  <button @click="cancelRename" class="btn btn-small">Cancel</button>
                </template>
                <template v-else>
                  <span class="item-name">{{ member.name }}</span>
                  <span v-if="member.joinedFrom" class="item-meta">since {{ member.joinedFrom }}</span>
                  <span v-if="member.departedFrom" class="item-meta badge-departed">departed {{ member.departedFrom }}</span>
                  <span class="item-actions">
                    <button @click="startRename(member)" class="btn btn-tiny">Rename</button>
                    <template v-if="member.departedFrom === undefined">
                      <input v-model="departingMemberEffFrom[member.id]" placeholder="Depart YYYY-MM" size="7" class="input input-xs" />
                      <button @click="departMember(member.id)" class="btn btn-tiny btn-danger">Depart</button>
                    </template>
                  </span>
                </template>
              </li>
            </ul>
            <p v-if="members.length === 0" class="empty-state">No members yet. Add the first member above.</p>
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Income</h2>
              <button @click="showIncomeForm = !showIncomeForm" class="btn btn-small">{{ showIncomeForm ? 'Cancel' : '+ Add Income' }}</button>
            </div>
            <form v-if="showIncomeForm" @submit.prevent="submitIncomeSource" class="add-form">
              <select v-model="newSourceMemberId" class="input">
                <option value="" disabled>Member</option>
                <option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }}</option>
              </select>
              <input v-model="newSourceName" placeholder="Source name" class="input" />
              <input v-model="newSourceAmount" placeholder="Monthly amount" type="number" step="0.01" min="0" class="input" />
              <input v-model="newSourceEffectiveFrom" placeholder="From (YYYY-MM)" class="input input-sm" />
              <label class="checkbox-label"><input type="checkbox" v-model="newSourceRestricted" /> Restricted</label>
              <label class="checkbox-label"><input type="checkbox" v-model="newSourceOneOff" /> One-off</label>
              <button type="submit" class="btn btn-primary btn-small">Save</button>
            </form>
            <div v-for="member in members" :key="member.id" class="subsection">
              <h3 v-if="sourcesForMember(member.id).length > 0" class="subsection-title">{{ member.name }}</h3>
              <ul class="item-list">
                <li v-for="source in sourcesForMember(member.id)" :key="source.id" class="item-row">
                  <template v-if="editingSourceId === source.id">
                    <span class="edit-row">
                      <input v-model="editingSourceAmount" placeholder="Amount" class="input input-sm" />
                      <input v-model="editingSourceEffectiveFrom" placeholder="From YYYY-MM" class="input input-sm" />
                      <button @click="commitEditSource()" class="btn btn-tiny">Save</button>
                    </span>
                  </template>
                  <template v-else>
                    <span class="item-name" :class="{ 'ended': source.endedFrom }">{{ source.name }}</span>
                    <span class="item-value">{{ formatCurrency(latestAmount(source), summary.currency) }}</span>
                    <span v-if="source.restrictedUse" class="badge badge-restricted">restricted</span>
                    <span v-if="source.endedFrom" class="item-meta">ended {{ source.endedFrom }}</span>
                    <span v-else class="item-meta">since {{ source.timeline[0]?.effectiveFrom }}</span>
                    <span class="item-actions">
                      <button @click="startEditSource(source)" class="btn btn-tiny">Update</button>
                      <template v-if="source.endedFrom === undefined">
                        <input v-model="endingSourceEffectiveFrom[source.id]" placeholder="End YYYY-MM" size="7" class="input input-xs" />
                        <button @click="endSource(source.id, endingSourceEffectiveFrom[source.id] ?? currentMonth())" class="btn btn-tiny btn-danger">End</button>
                      </template>
                    </span>
                  </template>
                </li>
              </ul>
            </div>
            <p v-if="incomeSources.length === 0" class="empty-state">No income recorded. Add your first income source above.</p>
          </section>
        </div>

        <div class="grid-right">
          <section class="card">
            <div class="card-header">
              <h2>Expenses</h2>
              <button @click="showExpenseForm = !showExpenseForm" class="btn btn-small">{{ showExpenseForm ? 'Cancel' : '+ Add Expense' }}</button>
            </div>
            <form v-if="showExpenseForm" @submit.prevent="submitExpense" class="add-form">
              <input v-model="newExpenseName" placeholder="Expense name" class="input" />
              <fieldset class="checkbox-group">
                <legend>Participants</legend>
                <label v-for="member in members" :key="member.id" class="checkbox-label">
                  <input type="checkbox" :value="member.id" @change="toggleParticipant(member.id)" /> {{ member.name }}
                </label>
              </fieldset>
              <select v-model="newExpenseSplitRule" class="input">
                <option value="even">Even</option>
                <option value="proportional">Proportional to Income</option>
                <option value="custom">Custom</option>
              </select>
              <template v-if="newExpenseSplitRule === 'custom'">
                <select v-model="newExpenseCustomMode" class="input input-sm">
                  <option value="percent">Percent</option>
                  <option value="amount">Amount</option>
                </select>
                <div v-for="member in members" :key="member.id" class="custom-value-row">
                  <label>{{ member.name }}</label>
                  <input type="number" :placeholder="newExpenseCustomMode === 'percent' ? '%' : '$'" min="0"
                    :value="newExpenseCustomValues[member.id] ?? ''" class="input input-sm"
                    @input="newExpenseCustomValues[member.id] = parseFloat(($event.target as HTMLInputElement).value) || 0" />
                </div>
              </template>
              <label class="checkbox-label"><input type="checkbox" v-model="newExpenseOneOff" /> One-off</label>
              <input v-model="newExpenseEffectiveFrom" placeholder="From (YYYY-MM)" class="input input-sm" />
              <button type="submit" class="btn btn-primary btn-small">Save</button>
            </form>
            <div class="subsection" v-if="activeExpenses().length > 0">
              <h3 class="subsection-title">Active this Month</h3>
              <ul class="item-list">
                <li v-for="expense in activeExpenses()" :key="expense.id" class="item-row" :class="{ pending: !expenseHasAmount(expense.id) }">
                  <span class="item-name" :class="{ ended: expense.endedFrom }">{{ expense.name }}</span>
                  <span v-if="!expenseHasAmount(expense.id)" class="badge badge-warn">pending</span>
                  <template v-else>
                    <span class="item-value">Amount entered</span>
                  </template>
                  <span class="item-meta">{{ expense.splitRule.method }} &bull; {{ expense.participants.length }} participant(s)</span>
                  <div class="item-detail">
                    <template v-if="!expenseHasAmount(expense.id)">
                      <input v-model="expenseAmountValues[expense.id]" placeholder="$" type="number" step="0.01" min="0" class="input input-xs" />
                      <button @click="submitExpenseAmount(expense.id)" class="btn btn-tiny">Save</button>
                    </template>
                    <template v-if="expense.endedFrom === undefined">
                      <button @click="showChangeSplit = expense.id; changeSplitRule = expense.splitRule.method === 'even' ? 'even' : expense.splitRule.method === 'proportional' ? 'proportional' : 'custom'; changeSplitEff = ''" class="btn btn-tiny">Change Split</button>
                      <button @click="showChangeParticipants = expense.id; changeParticipantsList = [...expense.participants]; changeParticipantsEff = ''" class="btn btn-tiny">Change Participants</button>
                      <input v-model="endingExpenseEffectiveFrom[expense.id]" placeholder="End YYYY-MM" size="7" class="input input-xs" />
                      <button @click="endExpense(expense.id)" class="btn btn-tiny btn-danger">End</button>
                    </template>
                    <div v-if="showChangeSplit === expense.id" class="change-form">
                      <select v-model="changeSplitRule" class="input input-sm"><option value="even">Even</option><option value="proportional">Proportional</option></select>
                      From <input v-model="changeSplitEff" placeholder="YYYY-MM" size="7" class="input input-xs" />
                      <span v-if="backdateWarning(changeSplitEff)" class="badge badge-warn">{{ backdateWarning(changeSplitEff) }}</span>
                      <button @click="submitChangeSplit(expense.id)" class="btn btn-tiny btn-primary">Confirm</button>
                    </div>
                    <div v-if="showChangeParticipants === expense.id" class="change-form">
                      <label v-for="member in members" :key="member.id" class="checkbox-label">
                        <input type="checkbox" :checked="changeParticipantsList.includes(member.id)" @change="changeParticipantsList.includes(member.id) ? changeParticipantsList = changeParticipantsList.filter(i => i !== member.id) : changeParticipantsList.push(member.id)" /> {{ member.name }}
                      </label>
                      From <input v-model="changeParticipantsEff" placeholder="YYYY-MM" size="7" class="input input-xs" />
                      <span v-if="backdateWarning(changeParticipantsEff)" class="badge badge-warn">{{ backdateWarning(changeParticipantsEff) }}</span>
                      <button @click="submitChangeParticipants(expense.id)" class="btn btn-tiny btn-primary">Confirm</button>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
            <p v-if="expenses.length === 0" class="empty-state">No expenses defined. Add your first expense above.</p>
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Goals</h2>
              <button @click="showGoalForm = !showGoalForm" class="btn btn-small">{{ showGoalForm ? 'Cancel' : '+ Add Goal' }}</button>
            </div>
            <form v-if="showGoalForm" @submit.prevent="submitGoal" class="add-form">
              <input v-model="newGoalName" placeholder="Goal name" class="input" />
              <fieldset class="checkbox-group">
                <legend>Participants</legend>
                <label v-for="member in members" :key="member.id" class="checkbox-label">
                  <input type="checkbox" :value="member.id" @change="toggleGoalParticipant(member.id)" /> {{ member.name }}
                </label>
              </fieldset>
              <select v-model="newGoalSplitRule" class="input"><option value="even">Even</option><option value="proportional">Proportional</option></select>
              <input v-model="newGoalTarget" placeholder="Target amount (optional)" type="number" step="0.01" min="0" class="input" />
              <input v-model="newGoalEffectiveFrom" placeholder="From (YYYY-MM)" class="input input-sm" />
              <button type="submit" class="btn btn-primary btn-small">Save</button>
            </form>
            <div class="subsection">
              <h3 class="subsection-title" v-if="summary.goalProgress.length > 0">Progress</h3>
              <ul class="item-list">
                <li v-for="gp in summary.goalProgress" :key="gp.goalId" class="item-row">
                  <span class="item-name">{{ gp.goalName }}</span>
                  <span class="item-value">{{ formatCurrency(gp.accumulatedCents, summary.currency) }}
                    <template v-if="gp.targetAmountCents !== undefined"> / {{ formatCurrency(gp.targetAmountCents, summary.currency) }}</template>
                  </span>
                </li>
              </ul>
            </div>
            <div class="subsection" v-if="goals.length > 0">
              <h3 class="subsection-title">Manage</h3>
              <ul class="item-list">
                <li v-for="g in goals" :key="g.id" class="item-row">
                  <span class="item-name" :class="{ ended: g.endedFrom !== undefined }">{{ g.name }}</span>
                  <template v-if="g.endedFrom === undefined">
                    <input v-model="goalContributionValues[g.id]" placeholder="$" type="number" step="0.01" min="0" class="input input-xs" />
                    <button @click="submitGoalContribution(g.id)" class="btn btn-tiny">Save</button>
                    <input v-model="endingGoalEffectiveFrom[g.id]" placeholder="End YYYY-MM" size="7" class="input input-xs" />
                    <button @click="endGoal(g.id)" class="btn btn-tiny btn-danger">End</button>
                  </template>
                  <span v-else class="item-meta badge-departed">ended {{ g.endedFrom }}</span>
                </li>
              </ul>
            </div>
            <p v-if="goals.length === 0" class="empty-state">No goals defined. Add your first savings goal above.</p>
          </section>
        </div>
      </div>

      <section class="card leftover-card" v-if="summary.members.length > 0">
        <div class="card-header"><h2>Leftover</h2></div>
        <div class="leftover-grid">
          <div v-for="member in summary.members" :key="member.memberId" class="leftover-member">
            <h3>{{ member.name }}</h3>
            <div class="leftover-lines">
              <div class="leftover-line">Income <span>{{ formatCurrency(includeRestricted ? member.incomeCents : member.incomeCents - member.restrictedCents, summary.currency) }}</span></div>
              <div class="leftover-line" v-if="member.restrictedCents > 0">Restricted <span class="dim">{{ formatCurrency(member.restrictedCents, summary.currency) }}</span></div>
              <div class="leftover-line">− Shares <span>{{ formatCurrency(member.totalCents, summary.currency) }}</span></div>
              <div class="leftover-line" v-if="member.contributionCents > 0">− Goals <span>{{ formatCurrency(member.contributionCents, summary.currency) }}</span></div>
              <div class="leftover-line leftover-result" :class="{ negative: member.leftoverCents < 0 }">
                = Leftover
                <span>{{ formatCurrency(includeRestricted ? member.incomeCents - member.contributionCents - member.totalCents : member.leftoverCents, summary.currency) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style>
:root {
  --bg: #f5f6fa;
  --card-bg: #ffffff;
  --primary: #3b82f6;
  --primary-hover: #2563eb;
  --danger: #ef4444;
  --danger-hover: #dc2626;
  --warn: #f59e0b;
  --info: #06b6d4;
  --text: #1e293b;
  --text-dim: #64748b;
  --border: #e2e8f0;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,.08);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; }

.app { max-width: 1100px; margin: 0 auto; padding: 16px 24px 48px; }

.app-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
.app-header h1 { margin: 0; font-size: 22px; }
.version { color: var(--text-dim); font-size: 12px; }

.error-banner { background: #fee2e2; color: #991b1b; padding: 8px 12px; border-radius: var(--radius); }
.loading { color: var(--text-dim); text-align: center; padding: 40px; }

.setup-card { max-width: 420px; margin: 40px auto; }
.setup-card h2 { margin-top: 0; }

.nav-bar {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--card-bg); border-radius: var(--radius); padding: 8px 16px;
  margin-bottom: 12px; box-shadow: var(--shadow);
}
.nav-left { display: flex; align-items: center; gap: 6px; }
.month-label { font-weight: 600; font-size: 16px; min-width: 72px; text-align: center; }
.nav-right { display: flex; gap: 6px; }

.stats-strip {
  display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;
}
.stat {
  background: var(--card-bg); border-radius: var(--radius); padding: 8px 16px;
  box-shadow: var(--shadow); display: flex; flex-direction: column;
}
.stat-name { font-size: 11px; color: var(--text-dim); text-transform: uppercase; }
.stat-value { font-size: 18px; font-weight: 700; }
.stat-value.negative { color: var(--danger); }
.stat-toggle { justify-content: center; }

.dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
@media (max-width: 750px) { .dashboard-grid { grid-template-columns: 1fr; } }

.card { background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.card-header h2 { margin: 0; font-size: 15px; }

.add-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding: 8px 0 12px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
.add-form .input { flex: 1 1 120px; }

.item-list { list-style: none; margin: 0; padding: 0; }
.item-row { padding: 6px 0; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.item-row:last-child { border-bottom: none; }
.item-row.pending { background: #fff7ed; padding: 6px; border-radius: 4px; }
.item-name { font-weight: 500; flex: 0 0 auto; }
.item-name.ended { text-decoration: line-through; color: var(--text-dim); }
.item-value { color: var(--text-dim); flex: 0 0 auto; }
.item-meta { font-size: 11px; color: var(--text-dim); }
.item-actions { margin-left: auto; display: flex; gap: 4px; align-items: center; }
.item-detail { width: 100%; display: flex; gap: 4px; align-items: center; flex-wrap: wrap; padding: 4px 0 0 4px; }

.subsection { margin-bottom: 4px; }
.subsection-title { font-size: 12px; color: var(--text-dim); text-transform: uppercase; margin: 8px 0 4px; }

.empty-state { color: var(--text-dim); font-style: italic; padding: 12px 0; }

.btn {
  background: var(--border); border: 1px solid transparent; border-radius: 4px;
  padding: 6px 12px; cursor: pointer; font-size: 13px; color: var(--text);
  white-space: nowrap;
}
.btn:hover { background: #cbd5e1; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-hover); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { background: var(--danger-hover); }
.btn-small { padding: 4px 8px; font-size: 12px; }
.btn-tiny { padding: 2px 6px; font-size: 11px; }

.input { padding: 6px 8px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; }
.input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59,130,246,.15); }
.input-sm { padding: 4px 6px; font-size: 12px; }
.input-xs { padding: 2px 4px; font-size: 11px; width: 86px; }

select.input { background: #fff; }

.badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 500; }
.badge-warn { background: #fef3c7; color: #92400e; }
.badge-info { background: #dbeafe; color: #1e40af; }
.badge-restricted { background: #f3e8ff; color: #6b21a8; }
.badge-departed { background: #f1f5f9; color: var(--text-dim); }

.hint { color: var(--text-dim); margin: 0 0 8px; }

.checkbox-group { border: none; padding: 0; margin: 0; display: flex; gap: 10px; flex-wrap: wrap; }
.checkbox-group legend { font-size: 12px; color: var(--text-dim); margin-bottom: 2px; }
.checkbox-label { font-size: 12px; display: flex; align-items: center; gap: 3px; }
.custom-value-row { display: flex; align-items: center; gap: 4px; }
.custom-value-row label { font-size: 12px; min-width: 60px; }

.change-form { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; padding: 4px 0; }

.leftover-card { margin-top: 16px; }
.leftover-grid { display: flex; gap: 16px; flex-wrap: wrap; }
.leftover-member { flex: 1; min-width: 200px; }
.leftover-member h3 { margin: 0 0 8px; font-size: 14px; }
.leftover-lines { font-size: 13px; }
.leftover-line { display: flex; justify-content: space-between; padding: 2px 0; }
.leftover-line span { font-weight: 500; }
.leftover-line.dim { color: var(--text-dim); }
.leftover-result { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 4px; font-weight: 700; font-size: 15px; }
.leftover-result.negative { color: var(--danger); }

.edit-row { display: flex; gap: 4px; align-items: center; }
.inline-form { display: inline-flex; gap: 4px; align-items: center; }
</style>

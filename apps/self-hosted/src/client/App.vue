<script setup lang="ts">
import type { Expense, ExpenseAmount, GoalProgress, IncomeSource, Member, MonthlySummary, SavingsGoal } from "@prometheus/engine";
import { computed, onMounted, ref, watch } from "vue";
import Sidebar from "./components/Sidebar.vue";
import MonthBar from "./components/MonthBar.vue";
import OverviewPage from "./pages/OverviewPage.vue";
import IncomePage from "./pages/IncomePage.vue";
import ExpensesPage from "./pages/ExpensesPage.vue";
import GoalsPage from "./pages/GoalsPage.vue";
import MembersPage from "./pages/MembersPage.vue";

const currentMonth = (): string => new Date().toISOString().slice(0, 7);
const monthLabel = (m: string): string => {
  const [y, mn] = m.split("-").map(Number) as [number, number];
  return new Date(y, mn - 1).toLocaleString("default", { month: "long", year: "numeric" });
};

const page = ref<"overview" | "income" | "expenses" | "goals" | "members">("overview");
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
const householdLeftover = computed(() => (summary.value?.members ?? []).reduce((s, m) => s + m.leftoverCents, 0));

// --- member state ---
const newMemberName = ref(""); const newMemberJoinedFrom = ref(""); const editingMemberId = ref<string | null>(null); const editingMemberName = ref(""); const departingMemberEffFrom = ref<Record<string, string>>({}); const showMemberForm = ref(false); const departingMember = ref<string | null>(null);
// --- income state ---
const newSourceMemberId = ref(""); const newSourceName = ref(""); const newSourceAmount = ref(""); const newSourceEffectiveFrom = ref(""); const newSourceRestricted = ref(false); const newSourceOneOff = ref(false); const editingSourceId = ref<string | null>(null); const editingSourceAmount = ref(""); const editingSourceEffectiveFrom = ref(""); const endingSourceEffectiveFrom = ref<Record<string, string>>({}); const showIncomeForm = ref(false); const endingSource = ref<string | null>(null);
// --- expense state ---
const newExpenseName = ref(""); const newExpenseParticipants = ref<string[]>([]); const newExpenseSplitRule = ref("even"); const newExpenseCustomMode = ref("percent"); const newExpenseCustomValues = ref<Record<string, number>>({}); const newExpenseOneOff = ref(false); const newExpenseEffectiveFrom = ref(""); const expenseAmountValues = ref<Record<string, string>>({}); const endingExpenseEffectiveFrom = ref<Record<string, string>>({}); const showChangeSplit = ref<string | null>(null); const changeSplitRule = ref("even"); const changeSplitEff = ref(""); const showChangeParticipants = ref<string | null>(null); const changeParticipantsList = ref<string[]>([]); const changeParticipantsEff = ref(""); const showExpenseForm = ref(false); const expandedExpense = ref<string | null>(null); const endingExpense = ref<string | null>(null);
// --- goal state ---
const newGoalName = ref(""); const newGoalParticipants = ref<string[]>([]); const newGoalSplitRule = ref("even"); const newGoalTarget = ref(""); const newGoalStartAmount = ref(""); const newGoalEffectiveFrom = ref(""); const goalContributionValues = ref<Record<string, string>>({}); const endingGoalEffectiveFrom = ref<Record<string, string>>({}); const showGoalForm = ref(false); const endingGoal = ref<string | null>(null);

// --- helpers ---
function shiftMonth(m: string, d: number): string { const [y, mn] = m.split("-").map(Number) as [number, number]; const t = y * 12 + (mn - 1) + d; return `${String(Math.floor(t / 12)).padStart(4, "0")}-${String((t % 12) + 1).padStart(2, "0")}`; }
function activeExpenses() { return expenses.value.filter(e => e.effectiveFrom <= displayMonth.value && (e.endedFrom === undefined || e.endedFrom > displayMonth.value)); }
function expenseHasAmount(eid: string) { return expenseAmounts.value.some(a => a.expenseId === eid && a.month === displayMonth.value); }
function expenseAmountCents(eid: string) { return expenseAmounts.value.find(a => a.expenseId === eid && a.month === displayMonth.value)?.amountCents; }
function expenseShares(eid: string) { return (summary.value?.members ?? []).flatMap(m => m.shares.filter(s => s.expenseId === eid).map(s => ({ memberId: m.memberId, name: m.name, amountCents: s.amountCents }))); }
function sourcesForMember(mid: string) { return incomeSources.value.filter(s => s.memberId === mid); }
const latestAmount = (s: IncomeSource) => { const a = [...s.timeline].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)); return a[0]?.amountCents ?? 0; };
function goalProgressPercent(gp: { accumulatedCents: number; targetAmountCents?: number }) { if (!gp.targetAmountCents || gp.targetAmountCents === 0) return 0; return Math.min(100, Math.round((gp.accumulatedCents / gp.targetAmountCents) * 100)); }
function memberName(id: string) { return members.value.find(m => m.id === id)?.name ?? id; }
function backdateWarning(eff: string): string | null { if (!eff || eff >= displayMonth.value) return null; const [y, m] = eff.split("-").map(Number) as [number, number]; const [cy, cm] = displayMonth.value.split("-").map(Number) as [number, number]; return `Will recompute ${(cy - y) * 12 + (cm - m) + 1} months`; }
const formatCurrency = (cents: number, curr: string) => new Intl.NumberFormat(undefined, { style: "currency", currency: curr }).format(cents / 100);

async function unwrapError(r: Response): Promise<never> { const b = (await r.json().catch(() => ({}))) as { error?: string }; throw new Error(b.error ?? `HTTP ${r.status}`); }
const request = {
  async get(u: string) { const r = await fetch(u); if (!r.ok) await unwrapError(r); return r.json() as unknown; },
  async post(u: string, b: unknown) { const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); if (!r.ok) await unwrapError(r); return r.json() as unknown; },
  async patch(u: string, b: unknown) { const r = await fetch(u, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); if (!r.ok) await unwrapError(r); return r.json() as unknown; },
};

onMounted(async () => {
  try {
    const data = (await request.get("/api/household")) as { currency: string | null; members: Member[]; incomeSources: IncomeSource[]; expenses: Expense[]; expenseAmounts: ExpenseAmount[]; goals: SavingsGoal[] };
    currency.value = data.currency; members.value = data.members ?? []; incomeSources.value = data.incomeSources ?? []; expenses.value = data.expenses ?? []; expenseAmounts.value = data.expenseAmounts ?? []; goals.value = data.goals ?? [];
    if (currency.value) await refreshSummary();
  } catch (e) { appError.value = e instanceof Error ? e.message : String(e); }
  finally { loading.value = false; }
});
watch(displayMonth, async () => { await refreshSummary(); });
async function refreshSummary() { summary.value = (await request.get(`/api/summary?month=${displayMonth.value}`)) as MonthlySummary; }
async function loadAll() { const d = (await request.get("/api/household")) as { members: Member[]; incomeSources: IncomeSource[]; expenses: Expense[]; expenseAmounts: ExpenseAmount[]; goals: SavingsGoal[] }; members.value = d.members ?? []; incomeSources.value = d.incomeSources ?? []; expenses.value = d.expenses ?? []; expenseAmounts.value = d.expenseAmounts ?? []; goals.value = d.goals ?? []; }

// --- member actions ---
async function submitCurrency() { try { await request.post("/api/household/currency", { currency: currencyValue.value }); currency.value = currencyValue.value; await refreshSummary(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function submitMember() { const n = newMemberName.value.trim(); if (!n) return; try { const m = (await request.post("/api/members", { name: n, joinedFrom: newMemberJoinedFrom.value || undefined })) as Member; members.value = [...members.value, m]; newMemberName.value = ""; newMemberJoinedFrom.value = ""; showMemberForm.value = false; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function departMember(id: string) { const eff = departingMemberEffFrom.value[id] ?? currentMonth(); try { await request.post(`/api/members/${id}/depart`, { effectiveFrom: eff }); await loadAll(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
function startRename(m: Member) { editingMemberId.value = m.id; editingMemberName.value = m.name; }
async function commitRename(id: string) { const n = editingMemberName.value.trim(); if (!n) return; try { await request.patch(`/api/members/${id}`, { name: n }); members.value = members.value.map(m => m.id === id ? { ...m, name: n } : m); editingMemberId.value = null; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
// --- income actions ---
async function submitIncomeSource() { const mid = newSourceMemberId.value; const n = newSourceName.value.trim(); const a = parseFloat(newSourceAmount.value); const eff = newSourceEffectiveFrom.value; if (!mid || !n || isNaN(a) || !eff) return; try { const s = (await request.post("/api/income-sources", { memberId: mid, name: n, amountCents: Math.round(a * 100), effectiveFrom: eff, oneOff: newSourceOneOff.value, restrictedUse: newSourceRestricted.value })) as IncomeSource; incomeSources.value = [...incomeSources.value, s]; newSourceName.value = ""; newSourceAmount.value = ""; newSourceEffectiveFrom.value = ""; newSourceOneOff.value = false; newSourceRestricted.value = false; showIncomeForm.value = false; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
function startEditSource(s: IncomeSource) { editingSourceId.value = s.id; editingSourceAmount.value = String(latestAmount(s) / 100); editingSourceEffectiveFrom.value = ""; }
async function commitEditSource() { const id = editingSourceId.value; const a = parseFloat(editingSourceAmount.value); const eff = editingSourceEffectiveFrom.value; if (!id || isNaN(a) || !eff) return; try { await request.post(`/api/income-sources/${id}/amount`, { amountCents: Math.round(a * 100), effectiveFrom: eff }); await loadAll(); editingSourceId.value = null; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function endSource(id: string, eff: string) { try { await request.post(`/api/income-sources/${id}/end`, { effectiveFrom: eff }); await loadAll(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
// --- expense actions ---
async function submitExpense() { const n = newExpenseName.value.trim(); const p = [...newExpenseParticipants.value]; const eff = newExpenseEffectiveFrom.value; if (!n || p.length === 0 || !eff) return; try { let r: Record<string, unknown>; if (newExpenseSplitRule.value === "custom") r = { method: "custom", mode: newExpenseCustomMode.value, values: { ...newExpenseCustomValues.value } }; else r = { method: newExpenseSplitRule.value }; const e = (await request.post("/api/expenses", { name: n, participants: p, splitRule: r, effectiveFrom: eff, oneOff: newExpenseOneOff.value })) as Expense; expenses.value = [...expenses.value, e]; newExpenseName.value = ""; newExpenseParticipants.value = []; newExpenseCustomValues.value = {}; newExpenseOneOff.value = false; newExpenseEffectiveFrom.value = ""; showExpenseForm.value = false; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function submitExpenseAmount(eid: string) { const raw = expenseAmountValues.value[eid] ?? ""; const a = parseFloat(raw); if (isNaN(a)) return; try { await request.post(`/api/expenses/${eid}/amount`, { month: displayMonth.value, amountCents: Math.round(a * 100) }); delete expenseAmountValues.value[eid]; await loadAll(); await refreshSummary(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
function endExpense(id: string) { const eff = endingExpenseEffectiveFrom.value[id] ?? currentMonth(); request.post(`/api/expenses/${id}/end`, { effectiveFrom: eff }).then(async () => { await loadAll(); }).catch(e => { appError.value = e instanceof Error ? e.message : String(e); }); }
async function submitChangeSplit(eid: string) { const eff = changeSplitEff.value.trim(); if (!eff) return; try { await request.post(`/api/expenses/${eid}/change-split`, { splitRule: { method: changeSplitRule.value }, effectiveFrom: eff }); await loadAll(); await refreshSummary(); showChangeSplit.value = null; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function submitChangeParticipants(eid: string) { const eff = changeParticipantsEff.value.trim(); if (!eff) return; try { await request.post(`/api/expenses/${eid}/change-participants`, { participants: [...changeParticipantsList.value], effectiveFrom: eff }); await loadAll(); await refreshSummary(); showChangeParticipants.value = null; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
// --- goal actions ---
async function submitGoal() { const n = newGoalName.value.trim(); const p = [...newGoalParticipants.value]; const eff = newGoalEffectiveFrom.value; if (!n || p.length === 0 || !eff) return; try { await request.post("/api/goals", { name: n, participants: p, splitRule: { method: newGoalSplitRule.value }, targetAmountCents: newGoalTarget.value ? Math.round(parseFloat(newGoalTarget.value) * 100) : undefined, startAmountCents: newGoalStartAmount.value ? Math.round(parseFloat(newGoalStartAmount.value) * 100) : undefined, effectiveFrom: eff }); await loadAll(); newGoalName.value = ""; newGoalParticipants.value = []; newGoalTarget.value = ""; newGoalStartAmount.value = ""; newGoalEffectiveFrom.value = ""; showGoalForm.value = false; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function submitGoalContribution(gid: string) { const raw = goalContributionValues.value[gid] ?? ""; const a = parseFloat(raw); if (isNaN(a)) return; try { await request.post(`/api/goals/${gid}/contribution`, { month: displayMonth.value, amountCents: Math.round(a * 100) }); delete goalContributionValues.value[gid]; await loadAll(); await refreshSummary(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function endGoal(id: string) { const eff = endingGoalEffectiveFrom.value[id] ?? currentMonth(); try { await request.post(`/api/goals/${id}/end`, { effectiveFrom: eff }); await loadAll(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
</script>

<template>
  <div class="shell" v-if="currency !== null">
    <Sidebar :page="page" @navigate="(p) => page = p as any" />
    <main class="content">
      <p v-if="appError" class="error-banner">{{ appError }}</p>
      <p v-else-if="loading" class="loading">Loading…</p>
      <template v-else-if="summary">
        <MonthBar
          :displayMonth="displayMonth" :monthLabel="monthLabel(displayMonth)" :jumpMonth="jumpMonth"
          :pendingCount="summary.pendingExpenses.length + summary.pendingContributions.length"
          @prev="displayMonth = shiftMonth(displayMonth, -1)" @next="displayMonth = shiftMonth(displayMonth, 1)"
          @today="displayMonth = currentMonth()" @jump="() => { const m = jumpMonth.trim(); if (/^\d{4}-\d{2}$/.test(m)) { displayMonth = m; jumpMonth = ''; } }"
          @update:jumpMonth="(v: string) => jumpMonth = v"
        />

        <OverviewPage v-if="page === 'overview'"
          :summary="summary" :members="members" :expenses="expenses" :goals="goals"
          :activeExpenses="activeExpenses" :expenseHasAmount="expenseHasAmount" :expenseAmountCents="expenseAmountCents"
          :goalProgressPercent="goalProgressPercent" :memberName="memberName" :formatCurrency="formatCurrency"
          :householdLeftover="householdLeftover" />

        <IncomePage v-if="page === 'income'"
          :members="members" :incomeSources="incomeSources" :currency="summary.currency"
          :showForm="showIncomeForm" :newSourceMemberId="newSourceMemberId" :newSourceName="newSourceName"
          :newSourceAmount="newSourceAmount" :newSourceEffectiveFrom="newSourceEffectiveFrom"
          :newSourceRestricted="newSourceRestricted" :newSourceOneOff="newSourceOneOff"
          :editingSourceId="editingSourceId" :editingSourceAmount="editingSourceAmount" :editingSourceEffectiveFrom="editingSourceEffectiveFrom"
          :endingSourceEffectiveFrom="endingSourceEffectiveFrom" :endingSource="endingSource"
          :sourcesForMember="sourcesForMember" :latestAmount="latestAmount" :formatCurrency="formatCurrency"
          @toggleForm="showIncomeForm = !showIncomeForm" @submitIncome="submitIncomeSource"
          @startEdit="startEditSource" @commitEdit="commitEditSource"
          @endSource="(id, eff) => endSource(id, eff)" @cancelEdit="editingSourceId = null"
          @cancelEnd="endingSource = null" @startEndSource="(id) => endingSource = id"
          @update:newSourceMemberId="(v) => newSourceMemberId = v" @update:newSourceName="(v) => newSourceName = v"
          @update:newSourceAmount="(v) => newSourceAmount = v" @update:newSourceEffectiveFrom="(v) => newSourceEffectiveFrom = v"
          @update:newSourceRestricted="(v) => newSourceRestricted = v" @update:newSourceOneOff="(v) => newSourceOneOff = v"
          @update:editingSourceAmount="(v) => editingSourceAmount = v" @update:editingSourceEffectiveFrom="(v) => editingSourceEffectiveFrom = v"
          @update:endingSourceEffectiveFrom="(id, v) => endingSourceEffectiveFrom[id] = v"
        />

        <ExpensesPage v-if="page === 'expenses'"
          :members="members" :expenses="expenses" :currency="summary.currency" :displayMonth="displayMonth"
          :showForm="showExpenseForm" :newExpenseName="newExpenseName" :newExpenseParticipants="newExpenseParticipants"
          :newExpenseSplitRule="newExpenseSplitRule" :newExpenseCustomMode="newExpenseCustomMode" :newExpenseCustomValues="newExpenseCustomValues"
          :newExpenseOneOff="newExpenseOneOff" :newExpenseEffectiveFrom="newExpenseEffectiveFrom"
          :expenseAmountValues="expenseAmountValues" :endingExpenseEffectiveFrom="endingExpenseEffectiveFrom"
          :showChangeSplit="showChangeSplit" :changeSplitRule="changeSplitRule" :changeSplitEff="changeSplitEff"
          :showChangeParticipants="showChangeParticipants" :changeParticipantsList="changeParticipantsList"
          :changeParticipantsEff="changeParticipantsEff" :expandedExpense="expandedExpense" :endingExpense="endingExpense"
          :activeExpenses="activeExpenses" :expenseHasAmount="expenseHasAmount" :expenseAmountCents="expenseAmountCents"
          :expenseShares="expenseShares" :memberName="memberName" :backdateWarning="backdateWarning"
          :formatCurrency="formatCurrency"
          @toggleForm="showExpenseForm = !showExpenseForm" @submitExpense="submitExpense"
          @submitExpenseAmount="submitExpenseAmount" @endExpense="endExpense"
          @submitChangeSplit="submitChangeSplit" @submitChangeParticipants="submitChangeParticipants"
          @toggleParticipant="(id) => { const i = newExpenseParticipants.indexOf(id); if (i >= 0) newExpenseParticipants.splice(i, 1); else newExpenseParticipants.push(id); }"
          @update:newExpenseName="(v) => newExpenseName = v" @update:newExpenseSplitRule="(v) => newExpenseSplitRule = v"
          @update:newExpenseCustomMode="(v) => newExpenseCustomMode = v" @update:newExpenseCustomValues="(id, v) => newExpenseCustomValues[id] = v"
          @update:newExpenseOneOff="(v) => newExpenseOneOff = v" @update:newExpenseEffectiveFrom="(v) => newExpenseEffectiveFrom = v"
          @update:expenseAmountValues="(id, v) => expenseAmountValues[id] = v" @update:endingExpenseEffectiveFrom="(id, v) => endingExpenseEffectiveFrom[id] = v"
          @update:changeSplitRule="(v) => changeSplitRule = v" @update:changeSplitEff="(v) => changeSplitEff = v"
          @update:changeParticipantsEff="(v) => changeParticipantsEff = v" @toggleChangeParticipants="(id, checked) => { if (checked) changeParticipantsList.push(id); else { const i = changeParticipantsList.indexOf(id); if (i >= 0) changeParticipantsList.splice(i, 1); } }"
          @openChangeSplit="(id, rule) => { showChangeSplit = id; changeSplitRule = rule; changeSplitEff = ''; }"
          @openChangeParticipants="(id, list) => { showChangeParticipants = id; changeParticipantsList = [...list]; changeParticipantsEff = ''; }"
          @closeChangeSplit="showChangeSplit = null" @closeChangeParticipants="showChangeParticipants = null"
          @toggleDetails="(id) => expandedExpense = expandedExpense === id ? null : id"
          @startEndExpense="(id) => endingExpense = id" @cancelEndExpense="endingExpense = null"
        />

        <GoalsPage v-if="page === 'goals'"
          :members="members" :goals="goals" :currency="summary.currency"
          :showForm="showGoalForm" :newGoalName="newGoalName" :newGoalParticipants="newGoalParticipants"
          :newGoalSplitRule="newGoalSplitRule" :newGoalTarget="newGoalTarget" :newGoalStartAmount="newGoalStartAmount"
          :newGoalEffectiveFrom="newGoalEffectiveFrom" :goalContributionValues="goalContributionValues"
          :endingGoalEffectiveFrom="endingGoalEffectiveFrom" :endingGoal="endingGoal"
          :goalProgress="summary.goalProgress" :goalProgressPercent="goalProgressPercent"
          :memberName="memberName" :formatCurrency="formatCurrency"
          @toggleForm="showGoalForm = !showGoalForm" @submitGoal="submitGoal"
          @submitGoalContribution="submitGoalContribution" @endGoal="endGoal"
          @toggleGoalParticipant="(id) => { const i = newGoalParticipants.indexOf(id); if (i >= 0) newGoalParticipants.splice(i, 1); else newGoalParticipants.push(id); }"
          @update:newGoalName="(v) => newGoalName = v" @update:newGoalSplitRule="(v) => newGoalSplitRule = v"
          @update:newGoalTarget="(v) => newGoalTarget = v" @update:newGoalStartAmount="(v) => newGoalStartAmount = v"
          @update:newGoalEffectiveFrom="(v) => newGoalEffectiveFrom = v"
          @update:goalContributionValues="(id, v) => goalContributionValues[id] = v"
          @update:endingGoalEffectiveFrom="(id, v) => endingGoalEffectiveFrom[id] = v"
          @startEndGoal="(id) => endingGoal = id" @cancelEndGoal="endingGoal = null"
        />

        <MembersPage v-if="page === 'members'"
          :members="members" :showForm="showMemberForm" :newMemberName="newMemberName"
          :newMemberJoinedFrom="newMemberJoinedFrom" :editingMemberId="editingMemberId"
          :editingMemberName="editingMemberName" :departingMemberEffFrom="departingMemberEffFrom"
          :departingMember="departingMember"
          @toggleForm="showMemberForm = !showMemberForm" @submitMember="submitMember"
          @departMember="departMember" @startRename="startRename" @commitRename="commitRename"
          @cancelRename="editingMemberId = null"
          @update:newMemberName="(v) => newMemberName = v" @update:newMemberJoinedFrom="(v) => newMemberJoinedFrom = v"
          @update:editingMemberName="(v) => editingMemberName = v"
          @update:departingMemberEffFrom="(id, v) => departingMemberEffFrom[id] = v"
          @startDepart="(id) => departingMember = id" @cancelDepart="departingMember = null"
        />
      </template>
    </main>
  </div>

  <div class="setup-outer" v-else-if="currency === null && !loading">
    <div class="card setup-card">
      <h2>Welcome to Prometheus</h2>
      <p class="muted">Choose your household currency to get started. This cannot be changed later.</p>
      <form @submit.prevent="submitCurrency" style="display:flex;gap:8px;margin-top:12px">
        <input v-model="currencyValue" class="input" />
        <button type="submit" class="btn-accent">Set Currency</button>
      </form>
    </div>
  </div>
</template>

<style>
:root {
  --bg: #12141C; --card: #1A1D28; --border: #262A38; --text: #F0F1F5;
  --text2: #8B92A5; --muted: #6B7280; --accent: #E8935C; --accent2: #F0A868;
  --ice: #7DC9E8; --danger: #F87171; --warn: #FBBF24; --radius: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px; color: var(--text); background: var(--bg);
}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; }

.shell { display: flex; min-height: 100vh; }
.sidebar { width: 200px; flex-shrink: 0; background: var(--card); border-right: 0.5px solid var(--border); display: flex; flex-direction: column; padding: 20px 16px; }
.sidebar-brand { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 500; margin-bottom: 32px; color: var(--text); }
.planet-mark { width: 22px; height: 22px; position: relative; }
.planet-mark div { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); position: absolute; top: 6px; left: 6px; }
.planet-mark::after { content: ""; position: absolute; top: 2px; left: 0; width: 22px; height: 22px; border: 1px solid var(--ice); border-radius: 50%; transform: rotateX(60deg); }
.sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
.sidebar-nav button { all: unset; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--text2); }
.sidebar-nav button:hover { background: rgba(255,255,255,0.04); color: var(--text); }
.sidebar-nav button.active { background: rgba(232,147,92,0.10); color: var(--accent); }
.nav-dot { font-size: 8px; opacity: 0; }
.sidebar-nav button.active .nav-dot { opacity: 1; }

.content { flex: 1; padding: 24px 32px; overflow-y: auto; max-width: 960px; }

.error-banner { background: rgba(248,113,113,0.12); color: var(--danger); padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; }
.loading { color: var(--muted); padding: 40px; text-align: center; }

.month-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
.month-pill { display: flex; align-items: center; background: var(--card); border: 0.5px solid var(--border); border-radius: 10px; overflow: hidden; }
.month-pill .chevron { all: unset; cursor: pointer; padding: 6px 10px; font-size: 18px; color: var(--text2); }
.month-pill .chevron:hover { color: var(--text); }
.month-label { cursor: pointer; padding: 6px 12px; font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; }
.today-btn { all: unset; cursor: pointer; font-size: 12px; color: var(--text2); padding: 6px 12px; border: 0.5px solid var(--border); border-radius: 8px; }
.today-btn:hover { color: var(--text); border-color: var(--text2); }
.bar-divider { width: 0.5px; height: 24px; background: var(--border); }
.jump-wrap { display: flex; align-items: center; gap: 4px; flex: 1; }
.jump-icon { font-size: 12px; }
.jump-input { background: transparent; border: none; border-bottom: 0.5px solid var(--border); color: var(--text); font-size: 12px; padding: 4px 0; width: 140px; outline: none; }
.jump-input::placeholder { color: var(--muted); }
.jump-input:focus { border-color: var(--accent); }
.bar-spacer { flex: 1; }
.pending-badge { font-size: 11px; background: rgba(232,147,92,0.12); color: var(--accent); padding: 4px 10px; border-radius: 8px; font-weight: 500; }

.balance-row { display: flex; gap: 12px; margin-bottom: 20px; }
.balance-card { flex: 1; background: var(--card); border-radius: var(--radius); padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; border: 0.5px solid var(--border); }
.balance-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.balance-value { font-size: 24px; font-weight: 500; color: var(--text); }
.balance-value.negative { color: var(--danger); }
.balance-total .balance-value { color: var(--accent); }

.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.card { background: var(--card); border-radius: var(--radius); padding: 20px; border: 0.5px solid var(--border); margin-bottom: 16px; }
.card-label { font-size: 11px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px; }

.ov-list { list-style: none; margin: 0; padding: 0; }
.ov-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 0.5px solid var(--border); font-size: 13px; }
.ov-row:last-child { border-bottom: none; }
.ov-empty { color: var(--muted); font-size: 12px; padding: 8px 0; }
.pending { color: var(--warn); }
.ended { text-decoration: line-through; color: var(--muted); }
.tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(139,146,165,0.12); color: var(--text2); }
.tag.ended { background: rgba(139,146,165,0.06); }

.orbit-ring { width: 24px; height: 24px; flex-shrink: 0; }
.orbit-ring circle:last-child { transition: stroke-dashoffset 0.6s ease; }
.gp-pct { margin-left: auto; font-size: 12px; color: var(--ice); font-weight: 500; }

.leftover-row { display: flex; gap: 24px; flex-wrap: wrap; }
.leftover-col { flex: 1; min-width: 200px; }
.lcol-name { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px; }
.lcol-line { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
.lcol-line span:first-child { color: var(--text2); }
.lcol-line span:last-child { color: var(--text); font-variant-numeric: tabular-nums; }
.lcol-divider { height: 0.5px; background: var(--border); margin: 6px 0; }
.lcol-result { font-weight: 500; }
.lcol-result span:last-child { color: var(--accent); }
.lcol-line .muted { color: var(--muted); }
.muted { color: var(--muted); }

.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { margin: 0; font-size: 18px; font-weight: 500; }
.add-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding: 0 0 16px; margin-bottom: 16px; border-bottom: 0.5px solid var(--border); }
.add-form .input { flex: 1 1 120px; }

.input { padding: 6px 8px; background: var(--bg); border: 0.5px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; }
.input:focus { outline: none; border-color: var(--accent); }
.input-sm { padding: 4px 6px; font-size: 12px; }
.input-xs { padding: 2px 4px; font-size: 11px; width: 90px; }
select.input { color: var(--text); }

.btn-accent { all: unset; cursor: pointer; background: var(--accent); color: #12141C; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; }
.btn-accent:hover { background: var(--accent2); }
.btn-ghost { all: unset; cursor: pointer; font-size: 11px; color: var(--text2); padding: 3px 8px; border-radius: 6px; }
.btn-ghost:hover { background: rgba(255,255,255,0.04); color: var(--text); }
.btn-ghost.danger { color: var(--danger); }
.btn-ghost.danger:hover { background: rgba(248,113,113,0.08); }

.check { font-size: 12px; color: var(--text2); display: flex; align-items: center; gap: 3px; }
.check-group { border: none; padding: 0; margin: 0; display: flex; gap: 10px; flex-wrap: wrap; }
.check-group legend { font-size: 11px; color: var(--muted); margin-bottom: 2px; }
.cv-row { display: flex; align-items: center; gap: 4px; }
.cv-row label { font-size: 11px; min-width: 56px; color: var(--text2); }

.exp-row { flex-direction: column; align-items: stretch; }
.exp-main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.exp-amt { font-weight: 500; font-variant-numeric: tabular-nums; }
.exp-det { padding: 6px 0 6px 4px; display: flex; flex-direction: column; gap: 6px; }
.exp-actions { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.share-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; max-width: 200px; }
.share-total { border-top: 0.5px solid var(--border); margin-top: 2px; padding-top: 4px; font-weight: 500; }
.ch-form { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }

.setup-outer { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.setup-card { max-width: 400px; }
.setup-card h2 { margin: 0 0 4px; font-weight: 500; }
</style>

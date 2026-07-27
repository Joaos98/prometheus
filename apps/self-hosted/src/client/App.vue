<script setup lang="ts">
import type { Expense, ExpenseAmount, IncomeSource, Member, MonthlySummary, SavingsGoal } from "@prometheus/engine";
import { computed, onMounted, ref, watch } from "vue";

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
const includeRestricted = ref(false);
const householdIncome = computed(() => (summary.value?.members ?? []).reduce((s, m) => s + m.incomeCents, 0));
const householdLeftover = computed(() => (summary.value?.members ?? []).reduce((s, m) => s + m.leftoverCents, 0));

// --- member state ---
const newMemberName = ref(""); const newMemberJoinedFrom = ref(""); const editingMemberId = ref<string | null>(null); const editingMemberName = ref(""); const departingMemberEffFrom = ref<Record<string, string>>({}); const showMemberForm = ref(false);
// --- income state ---
const newSourceMemberId = ref(""); const newSourceName = ref(""); const newSourceAmount = ref(""); const newSourceEffectiveFrom = ref(""); const newSourceRestricted = ref(false); const newSourceOneOff = ref(false); const editingSourceId = ref<string | null>(null); const editingSourceAmount = ref(""); const editingSourceEffectiveFrom = ref(""); const endingSourceEffectiveFrom = ref<Record<string, string>>({}); const showIncomeForm = ref(false);
// --- expense state ---
const newExpenseName = ref(""); const newExpenseParticipants = ref<string[]>([]); const newExpenseSplitRule = ref("even"); const newExpenseCustomMode = ref("percent"); const newExpenseCustomValues = ref<Record<string, number>>({}); const newExpenseOneOff = ref(false); const newExpenseEffectiveFrom = ref(""); const expenseAmountValues = ref<Record<string, string>>({}); const endingExpenseEffectiveFrom = ref<Record<string, string>>({}); const showChangeSplit = ref<string | null>(null); const changeSplitRule = ref("even"); const changeSplitEff = ref(""); const showChangeParticipants = ref<string | null>(null); const changeParticipantsList = ref<string[]>([]); const changeParticipantsEff = ref(""); const showExpenseForm = ref(false); const expandedExpense = ref<string | null>(null);
// --- goal state ---
const newGoalName = ref(""); const newGoalParticipants = ref<string[]>([]); const newGoalSplitRule = ref("even"); const newGoalTarget = ref(""); const newGoalStartAmount = ref(""); const newGoalEffectiveFrom = ref(""); const goalContributionValues = ref<Record<string, string>>({}); const endingGoalEffectiveFrom = ref<Record<string, string>>({}); const showGoalForm = ref(false);

function shiftMonth(m: string, d: number): string { const [y, mn] = m.split("-").map(Number) as [number, number]; const t = y * 12 + (mn - 1) + d; return `${String(Math.floor(t / 12)).padStart(4, "0")}-${String((t % 12) + 1).padStart(2, "0")}`; }
function goPrev() { displayMonth.value = shiftMonth(displayMonth.value, -1); }
function goNext() { displayMonth.value = shiftMonth(displayMonth.value, 1); }
function goToday() { displayMonth.value = currentMonth(); }
function goJump() { const m = jumpMonth.value.trim(); if (/^\d{4}-\d{2}$/.test(m)) { displayMonth.value = m; jumpMonth.value = ""; } }

function sourcesForMember(mid: string) { return incomeSources.value.filter(s => s.memberId === mid); }
const latestAmount = (s: IncomeSource) => { const a = [...s.timeline].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)); return a[0]?.amountCents ?? 0; };
function memberName(id: string) { return members.value.find(m => m.id === id)?.name ?? id; }
function activeExpenses() { return expenses.value.filter(e => e.effectiveFrom <= displayMonth.value && (e.endedFrom === undefined || e.endedFrom > displayMonth.value)); }
function expenseHasAmount(eid: string) { return expenseAmounts.value.some(a => a.expenseId === eid && a.month === displayMonth.value); }
function expenseAmountCents(eid: string) { return expenseAmounts.value.find(a => a.expenseId === eid && a.month === displayMonth.value)?.amountCents; }
function expenseShares(eid: string) { return (summary.value?.members ?? []).flatMap(m => m.shares.filter(s => s.expenseId === eid).map(s => ({ memberId: m.memberId, name: m.name, amountCents: s.amountCents }))); }
function goalProgressPercent(gp: { accumulatedCents: number; targetAmountCents?: number }) { if (!gp.targetAmountCents || gp.targetAmountCents === 0) return 0; return Math.min(100, Math.round((gp.accumulatedCents / gp.targetAmountCents) * 100)); }
function toggleParticipant(mid: string) { const i = newExpenseParticipants.value.indexOf(mid); if (i >= 0) newExpenseParticipants.value.splice(i, 1); else newExpenseParticipants.value.push(mid); }
function toggleGoalParticipant(mid: string) { const i = newGoalParticipants.value.indexOf(mid); if (i >= 0) newGoalParticipants.value.splice(i, 1); else newGoalParticipants.value.push(mid); }

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
async function departMember(id: string) { const eff = departingMemberEffFrom.value[id] ?? currentMonth(); try { await request.post(`/api/members/${id}/depart`, { effectiveFrom: eff }); delete departingMemberEffFrom.value[id]; await refreshSummary(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
function startRename(m: Member) { editingMemberId.value = m.id; editingMemberName.value = m.name; }
async function commitRename(id: string) { const n = editingMemberName.value.trim(); if (!n) return; try { await request.patch(`/api/members/${id}`, { name: n }); members.value = members.value.map(m => m.id === id ? { ...m, name: n } : m); editingMemberId.value = null; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
function cancelRename() { editingMemberId.value = null; }
// --- income actions ---
async function submitIncomeSource() { const mid = newSourceMemberId.value; const n = newSourceName.value.trim(); const a = parseFloat(newSourceAmount.value); const eff = newSourceEffectiveFrom.value; if (!mid || !n || isNaN(a) || !eff) return; try { const s = (await request.post("/api/income-sources", { memberId: mid, name: n, amountCents: Math.round(a * 100), effectiveFrom: eff, oneOff: newSourceOneOff.value, restrictedUse: newSourceRestricted.value })) as IncomeSource; incomeSources.value = [...incomeSources.value, s]; newSourceName.value = ""; newSourceAmount.value = ""; newSourceEffectiveFrom.value = ""; newSourceOneOff.value = false; newSourceRestricted.value = false; showIncomeForm.value = false; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
function startEditSource(s: IncomeSource) { editingSourceId.value = s.id; editingSourceAmount.value = String(latestAmount(s) / 100); editingSourceEffectiveFrom.value = ""; }
async function commitEditSource() { const id = editingSourceId.value; const a = parseFloat(editingSourceAmount.value); const eff = editingSourceEffectiveFrom.value; if (!id || isNaN(a) || !eff) return; try { await request.post(`/api/income-sources/${id}/amount`, { amountCents: Math.round(a * 100), effectiveFrom: eff }); await loadAll(); editingSourceId.value = null; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function endSource(id: string, eff: string) { try { await request.post(`/api/income-sources/${id}/end`, { effectiveFrom: eff }); await loadAll(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
// --- expense actions ---
async function submitExpense() { const n = newExpenseName.value.trim(); const p = [...newExpenseParticipants.value]; const eff = newExpenseEffectiveFrom.value; if (!n || p.length === 0 || !eff) return; try { let r: Record<string, unknown>; if (newExpenseSplitRule.value === "custom") r = { method: "custom", mode: newExpenseCustomMode.value, values: { ...newExpenseCustomValues.value } }; else r = { method: newExpenseSplitRule.value }; const e = (await request.post("/api/expenses", { name: n, participants: p, splitRule: r, effectiveFrom: eff, oneOff: newExpenseOneOff.value })) as Expense; expenses.value = [...expenses.value, e]; newExpenseName.value = ""; newExpenseParticipants.value = []; newExpenseCustomValues.value = {}; newExpenseOneOff.value = false; newExpenseEffectiveFrom.value = ""; showExpenseForm.value = false; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function submitExpenseAmount(eid: string) { const raw = expenseAmountValues.value[eid] ?? ""; const a = parseFloat(raw); if (isNaN(a)) return; try { await request.post(`/api/expenses/${eid}/amount`, { month: displayMonth.value, amountCents: Math.round(a * 100) }); delete expenseAmountValues.value[eid]; await loadAll(); await refreshSummary(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
function endExpense(id: string) { const eff = endingExpenseEffectiveFrom.value[id] ?? currentMonth(); request.post(`/api/expenses/${id}/end`, { effectiveFrom: eff }).then(async () => { delete endingExpenseEffectiveFrom.value[id]; await loadAll(); }).catch(e => { appError.value = e instanceof Error ? e.message : String(e); }); }
async function submitChangeSplit(eid: string) { const eff = changeSplitEff.value.trim(); if (!eff) return; try { await request.post(`/api/expenses/${eid}/change-split`, { splitRule: { method: changeSplitRule.value }, effectiveFrom: eff }); await loadAll(); await refreshSummary(); showChangeSplit.value = null; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function submitChangeParticipants(eid: string) { const eff = changeParticipantsEff.value.trim(); if (!eff) return; try { await request.post(`/api/expenses/${eid}/change-participants`, { participants: [...changeParticipantsList.value], effectiveFrom: eff }); await loadAll(); await refreshSummary(); showChangeParticipants.value = null; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
function backdateWarning(eff: string): string | null { if (!eff || eff >= displayMonth.value) return null; const [y, m] = eff.split("-").map(Number) as [number, number]; const [cy, cm] = displayMonth.value.split("-").map(Number) as [number, number]; return `Will recompute ${(cy - y) * 12 + (cm - m) + 1} months`; }
// --- goal actions ---
async function submitGoal() { const n = newGoalName.value.trim(); const p = [...newGoalParticipants.value]; const eff = newGoalEffectiveFrom.value; if (!n || p.length === 0 || !eff) return; try { await request.post("/api/goals", { name: n, participants: p, splitRule: { method: newGoalSplitRule.value }, targetAmountCents: newGoalTarget.value ? Math.round(parseFloat(newGoalTarget.value) * 100) : undefined, startAmountCents: newGoalStartAmount.value ? Math.round(parseFloat(newGoalStartAmount.value) * 100) : undefined, effectiveFrom: eff }); await loadAll(); newGoalName.value = ""; newGoalParticipants.value = []; newGoalTarget.value = ""; newGoalStartAmount.value = ""; newGoalEffectiveFrom.value = ""; showGoalForm.value = false; } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function submitGoalContribution(gid: string) { const raw = goalContributionValues.value[gid] ?? ""; const a = parseFloat(raw); if (isNaN(a)) return; try { await request.post(`/api/goals/${gid}/contribution`, { month: displayMonth.value, amountCents: Math.round(a * 100) }); delete goalContributionValues.value[gid]; await loadAll(); await refreshSummary(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
async function endGoal(id: string) { const eff = endingGoalEffectiveFrom.value[id] ?? currentMonth(); try { await request.post(`/api/goals/${id}/end`, { effectiveFrom: eff }); delete endingGoalEffectiveFrom.value[id]; await loadAll(); } catch (e) { appError.value = e instanceof Error ? e.message : String(e); } }
</script>

<template>
  <div class="shell" v-if="currency !== null">
    <aside class="sidebar">
      <div class="sidebar-brand"><div class="planet-mark"><div></div></div><span>Prometheus</span></div>
      <nav class="sidebar-nav">
        <button :class="{ active: page === 'overview' }" @click="page = 'overview'"><span class="nav-dot">●</span> Overview</button>
        <button :class="{ active: page === 'income' }" @click="page = 'income'"><span class="nav-dot">●</span> Income</button>
        <button :class="{ active: page === 'expenses' }" @click="page = 'expenses'"><span class="nav-dot">●</span> Expenses</button>
        <button :class="{ active: page === 'goals' }" @click="page = 'goals'"><span class="nav-dot">●</span> Goals</button>
        <button :class="{ active: page === 'members' }" @click="page = 'members'"><span class="nav-dot">●</span> Members</button>
      </nav>
    </aside>
    <main class="content">
      <p v-if="appError" class="error-banner">{{ appError }}</p>
      <p v-else-if="loading" class="loading">Loading…</p>
      <template v-else-if="summary">

        <!-- month bar -->
        <header class="month-bar">
          <div class="month-pill">
            <button @click="goPrev" class="chevron">&lsaquo;</button>
            <span class="month-label" @click="goToday">📅 {{ monthLabel(displayMonth) }}</span>
            <button @click="goNext" class="chevron">&rsaquo;</button>
          </div>
          <button @click="goToday" class="today-btn">Today</button>
          <span class="bar-divider"></span>
          <div class="jump-wrap">
            <span class="jump-icon">🔍</span>
            <input v-model="jumpMonth" @keydown.enter="goJump" placeholder="Jump to YYYY-MM" class="jump-input" />
          </div>
          <span class="bar-spacer"></span>
          <span v-if="summary.pendingExpenses.length > 0" class="pending-badge">🚩 {{ summary.pendingExpenses.length }} pending</span>
        </header>

        <!-- ========== OVERVIEW ========== -->
        <template v-if="page === 'overview'">
          <section class="balance-row">
            <div class="balance-card" v-for="m in summary.members" :key="m.memberId">
              <span class="balance-label">{{ m.name }}</span>
              <span class="balance-value" :class="{ negative: m.leftoverCents < 0 }">{{ formatCurrency(m.leftoverCents, summary.currency) }}</span>
            </div>
            <div class="balance-card balance-total">
              <span class="balance-label">Household</span>
              <span class="balance-value" :class="{ negative: householdLeftover < 0 }">{{ formatCurrency(householdLeftover, summary.currency) }}</span>
            </div>
          </section>

          <section class="overview-grid">
            <div class="card">
              <h3 class="card-label">Active expenses</h3>
              <ul class="ov-list">
                <li v-for="e in activeExpenses()" :key="e.id" class="ov-row">
                  <span :class="{ pending: !expenseHasAmount(e.id) }">{{ e.name }}</span>
                  <span v-if="expenseHasAmount(e.id)">{{ formatCurrency(expenseAmountCents(e.id)!, summary.currency) }}</span>
                  <span v-else class="pending-badge">pending</span>
                </li>
                <li v-if="activeExpenses().length === 0" class="ov-empty">No active expenses</li>
              </ul>
            </div>
            <div class="card">
              <h3 class="card-label">Goal progress</h3>
              <ul class="ov-list">
                <li v-for="gp in summary.goalProgress" :key="gp.goalId" class="ov-row">
                  <svg class="orbit-ring" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#262A38" stroke-width="3" /><circle cx="16" cy="16" r="13" fill="none" stroke="#7DC9E8" stroke-width="3" stroke-dasharray="81.7" :stroke-dashoffset="81.7 * (1 - goalProgressPercent(gp) / 100)" stroke-linecap="round" transform="rotate(-90 16 16)" /></svg>
                  <span>{{ gp.goalName }}</span>
                  <span class="gp-pct">{{ goalProgressPercent(gp) }}%</span>
                </li>
                <li v-if="summary.goalProgress.length === 0" class="ov-empty">No goals yet</li>
              </ul>
            </div>
          </section>

          <section class="card">
            <h3 class="card-label">Leftover</h3>
            <div class="leftover-row">
              <div class="leftover-col" v-for="m in summary.members" :key="m.memberId">
                <span class="lcol-name">{{ m.name }}</span>
                <div class="lcol-line"><span>Income</span><span>{{ formatCurrency(m.incomeCents - m.restrictedCents, summary.currency) }}</span></div>
                <div class="lcol-line" v-if="m.restrictedCents > 0"><span>Restricted</span><span class="muted">{{ formatCurrency(m.restrictedCents, summary.currency) }}</span></div>
                <div class="lcol-line"><span>− Shares</span><span>{{ formatCurrency(m.totalCents, summary.currency) }}</span></div>
                <div class="lcol-line" v-if="m.contributionCents > 0"><span>− Goals</span><span>{{ formatCurrency(m.contributionCents, summary.currency) }}</span></div>
                <div class="lcol-divider"></div>
                <div class="lcol-line lcol-result"><span>= Leftover</span><span>{{ formatCurrency(m.leftoverCents, summary.currency) }}</span></div>
              </div>
            </div>
          </section>
        </template>

        <!-- ========== INCOME ========== -->
        <template v-if="page === 'income'">
          <div class="page-header"><h2>Income</h2><button @click="showIncomeForm = !showIncomeForm" class="btn-accent">{{ showIncomeForm ? 'Cancel' : '+ Add' }}</button></div>
          <form v-if="showIncomeForm" @submit.prevent="submitIncomeSource" class="add-form">
            <select v-model="newSourceMemberId" class="input"><option value="" disabled>Member</option><option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option></select>
            <input v-model="newSourceName" placeholder="Source name" class="input" />
            <input v-model="newSourceAmount" placeholder="Amount" type="number" step="0.01" min="0" class="input" />
            <input v-model="newSourceEffectiveFrom" placeholder="From YYYY-MM" class="input input-sm" />
            <label class="check"><input type="checkbox" v-model="newSourceRestricted" /> Restricted</label>
            <label class="check"><input type="checkbox" v-model="newSourceOneOff" /> One-off</label>
            <button type="submit" class="btn-accent">Save</button>
          </form>
          <div v-for="m in members" :key="m.id" class="card">
            <h3 class="card-label" v-if="sourcesForMember(m.id).length > 0">{{ m.name }}</h3>
            <ul class="ov-list">
              <li v-for="s in sourcesForMember(m.id)" :key="s.id" class="ov-row">
                <template v-if="editingSourceId === s.id">
                  <input v-model="editingSourceAmount" placeholder="Amount" class="input input-sm" />
                  <input v-model="editingSourceEffectiveFrom" placeholder="From YYYY-MM" class="input input-sm" />
                  <button @click="commitEditSource()" class="btn-ghost">Save</button>
                </template>
                <template v-else>
                  <span :class="{ ended: s.endedFrom }">{{ s.name }}</span>
                  <span>{{ formatCurrency(latestAmount(s), summary.currency) }}</span>
                  <span v-if="s.restrictedUse" class="tag">restricted</span>
                  <button @click="startEditSource(s)" class="btn-ghost">Update</button>
                  <template v-if="s.endedFrom === undefined"><input v-model="endingSourceEffectiveFrom[s.id]" placeholder="End YYYY-MM" size="7" class="input input-xs" /><button @click="endSource(s.id, endingSourceEffectiveFrom[s.id] ?? currentMonth())" class="btn-ghost danger">End</button></template>
                </template>
              </li>
            </ul>
          </div>
        </template>

        <!-- ========== EXPENSES ========== -->
        <template v-if="page === 'expenses'">
          <div class="page-header"><h2>Expenses</h2><button @click="showExpenseForm = !showExpenseForm" class="btn-accent">{{ showExpenseForm ? 'Cancel' : '+ Add' }}</button></div>
          <form v-if="showExpenseForm" @submit.prevent="submitExpense" class="add-form">
            <input v-model="newExpenseName" placeholder="Expense name" class="input" />
            <fieldset class="check-group"><legend>Participants</legend><label v-for="m in members" :key="m.id" class="check"><input type="checkbox" :value="m.id" @change="toggleParticipant(m.id)" /> {{ m.name }}</label></fieldset>
            <select v-model="newExpenseSplitRule" class="input"><option value="even">Even</option><option value="proportional">Proportional to Income</option><option value="custom">Custom</option></select>
            <template v-if="newExpenseSplitRule === 'custom'">
              <select v-model="newExpenseCustomMode" class="input input-sm"><option value="percent">Percent</option><option value="amount">Amount</option></select>
              <div v-for="m in members" :key="m.id" class="cv-row"><label>{{ m.name }}</label><input type="number" :placeholder="newExpenseCustomMode === 'percent' ? '%' : '$'" min="0" :value="newExpenseCustomValues[m.id] ?? ''" class="input input-sm" @input="newExpenseCustomValues[m.id] = parseFloat(($event.target as HTMLInputElement).value) || 0" /></div>
            </template>
            <label class="check"><input type="checkbox" v-model="newExpenseOneOff" /> One-off</label>
            <input v-model="newExpenseEffectiveFrom" placeholder="From YYYY-MM" class="input input-sm" />
            <button type="submit" class="btn-accent">Save</button>
          </form>
          <div class="card" v-if="activeExpenses().length > 0">
            <h3 class="card-label">Active this Month</h3>
            <ul class="ov-list">
              <li v-for="e in activeExpenses()" :key="e.id" class="ov-row exp-row" :class="{ pending: !expenseHasAmount(e.id) }">
                <div class="exp-main"><span :class="{ ended: e.endedFrom }">{{ e.name }}</span><span v-if="expenseHasAmount(e.id)" class="exp-amt">{{ formatCurrency(expenseAmountCents(e.id)!, summary.currency) }}</span><span v-else class="pending-badge">pending</span><span class="muted">{{ e.splitRule.method === 'proportional' ? 'prop' : e.splitRule.method }}</span><span class="muted">{{ e.participants.map(memberName).join(', ') }}</span><button @click="expandedExpense = expandedExpense === e.id ? null : e.id" class="btn-ghost">{{ expandedExpense === e.id ? 'Hide' : 'Details' }}</button></div>
                <div v-if="expandedExpense === e.id" class="exp-det">
                  <div v-if="expenseShares(e.id).length > 0"><div v-for="s in expenseShares(e.id)" :key="s.memberId" class="share-row"><span>{{ s.name }}</span><span>{{ formatCurrency(s.amountCents, summary.currency) }}</span></div><div class="share-row share-total"><span>Total</span><span>{{ formatCurrency(expenseShares(e.id).reduce((sum, s) => sum + s.amountCents, 0), summary.currency) }}</span></div></div>
                  <template v-if="!expenseHasAmount(e.id)"><input v-model="expenseAmountValues[e.id]" placeholder="$" type="number" step="0.01" min="0" class="input input-xs" /><button @click="submitExpenseAmount(e.id)" class="btn-accent">Save</button></template>
                  <div v-if="e.endedFrom === undefined" class="exp-actions">
                    <button @click="showChangeSplit = e.id; changeSplitRule = e.splitRule.method === 'even' ? 'even' : e.splitRule.method === 'proportional' ? 'proportional' : 'custom'; changeSplitEff = ''" class="btn-ghost">Change Split</button>
                    <button @click="showChangeParticipants = e.id; changeParticipantsList = [...e.participants]; changeParticipantsEff = ''" class="btn-ghost">Change Participants</button>
                    <input v-model="endingExpenseEffectiveFrom[e.id]" placeholder="End YYYY-MM" size="7" class="input input-xs" /><button @click="endExpense(e.id)" class="btn-ghost danger">End</button>
                  </div>
                  <div v-if="showChangeSplit === e.id" class="ch-form"><select v-model="changeSplitRule" class="input input-sm"><option value="even">Even</option><option value="proportional">Proportional</option></select> From <input v-model="changeSplitEff" placeholder="YYYY-MM" size="7" class="input input-xs" /><span v-if="backdateWarning(changeSplitEff)" class="pending-badge">{{ backdateWarning(changeSplitEff) }}</span><button @click="submitChangeSplit(e.id)" class="btn-accent">Confirm</button></div>
                  <div v-if="showChangeParticipants === e.id" class="ch-form"><label v-for="m in members" :key="m.id" class="check"><input type="checkbox" :checked="changeParticipantsList.includes(m.id)" @change="changeParticipantsList.includes(m.id) ? changeParticipantsList = changeParticipantsList.filter(i => i !== m.id) : changeParticipantsList.push(m.id)" /> {{ m.name }}</label> From <input v-model="changeParticipantsEff" placeholder="YYYY-MM" size="7" class="input input-xs" /><span v-if="backdateWarning(changeParticipantsEff)" class="pending-badge">{{ backdateWarning(changeParticipantsEff) }}</span><button @click="submitChangeParticipants(e.id)" class="btn-accent">Confirm</button></div>
                </div>
              </li>
            </ul>
          </div>
        </template>

        <!-- ========== GOALS ========== -->
        <template v-if="page === 'goals'">
          <div class="page-header"><h2>Goals</h2><button @click="showGoalForm = !showGoalForm" class="btn-accent">{{ showGoalForm ? 'Cancel' : '+ Add' }}</button></div>
          <form v-if="showGoalForm" @submit.prevent="submitGoal" class="add-form">
            <input v-model="newGoalName" placeholder="Goal name" class="input" />
            <fieldset class="check-group"><legend>Participants</legend><label v-for="m in members" :key="m.id" class="check"><input type="checkbox" :value="m.id" @change="toggleGoalParticipant(m.id)" /> {{ m.name }}</label></fieldset>
            <select v-model="newGoalSplitRule" class="input"><option value="even">Even</option><option value="proportional">Proportional</option></select>
            <input v-model="newGoalTarget" placeholder="Target amount (optional)" type="number" step="0.01" min="0" class="input" />
            <input v-model="newGoalStartAmount" placeholder="Start amount (optional)" type="number" step="0.01" min="0" class="input" />
            <input v-model="newGoalEffectiveFrom" placeholder="From YYYY-MM" class="input input-sm" />
            <button type="submit" class="btn-accent">Save</button>
          </form>
          <div class="card" v-if="summary.goalProgress.length > 0">
            <h3 class="card-label">Progress</h3>
            <ul class="ov-list">
              <li v-for="gp in summary.goalProgress" :key="gp.goalId" class="ov-row">
                <svg class="orbit-ring" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#262A38" stroke-width="3" /><circle cx="16" cy="16" r="13" fill="none" stroke="#7DC9E8" stroke-width="3" stroke-dasharray="81.7" :stroke-dashoffset="81.7 * (1 - goalProgressPercent(gp) / 100)" stroke-linecap="round" transform="rotate(-90 16 16)" /></svg>
                <span>{{ gp.goalName }}</span>
                <span>{{ formatCurrency(gp.accumulatedCents, summary.currency) }}<template v-if="gp.targetAmountCents !== undefined"> / {{ formatCurrency(gp.targetAmountCents, summary.currency) }}</template></span>
                <span class="gp-pct">{{ goalProgressPercent(gp) }}%</span>
              </li>
            </ul>
          </div>
          <div class="card" v-if="goals.length > 0">
            <h3 class="card-label">Manage</h3>
            <ul class="ov-list">
              <li v-for="g in goals" :key="g.id" class="ov-row">
                <span :class="{ ended: g.endedFrom !== undefined }">{{ g.name }}</span>
                <template v-if="g.endedFrom === undefined">
                  <input v-model="goalContributionValues[g.id]" placeholder="$" type="number" step="0.01" min="0" class="input input-xs" /><button @click="submitGoalContribution(g.id)" class="btn-accent">Save</button>
                  <input v-model="endingGoalEffectiveFrom[g.id]" placeholder="End YYYY-MM" size="7" class="input input-xs" /><button @click="endGoal(g.id)" class="btn-ghost danger">End</button>
                </template>
                <span v-else class="muted">ended {{ g.endedFrom }}</span>
              </li>
            </ul>
          </div>
        </template>

        <!-- ========== MEMBERS ========== -->
        <template v-if="page === 'members'">
          <div class="page-header"><h2>Members</h2><button @click="showMemberForm = !showMemberForm" class="btn-accent">{{ showMemberForm ? 'Cancel' : '+ Add' }}</button></div>
          <form v-if="showMemberForm" @submit.prevent="submitMember" class="add-form">
            <input v-model="newMemberName" placeholder="Member name" class="input" />
            <input v-model="newMemberJoinedFrom" placeholder="From YYYY-MM" size="7" class="input input-sm" />
            <button type="submit" class="btn-accent">Save</button>
          </form>
          <div class="card">
            <ul class="ov-list">
              <li v-for="m in members" :key="m.id" class="ov-row">
                <template v-if="editingMemberId === m.id">
                  <input v-model="editingMemberName" class="input input-sm" /><button @click="commitRename(m.id)" class="btn-ghost">Save</button><button @click="cancelRename" class="btn-ghost">Cancel</button>
                </template>
                <template v-else>
                  <span>{{ m.name }}</span>
                  <span v-if="m.joinedFrom" class="muted">since {{ m.joinedFrom }}</span>
                  <span v-if="m.departedFrom" class="tag ended">departed {{ m.departedFrom }}</span>
                  <button @click="startRename(m)" class="btn-ghost">Rename</button>
                  <template v-if="m.departedFrom === undefined"><input v-model="departingMemberEffFrom[m.id]" placeholder="Depart YYYY-MM" size="7" class="input input-xs" /><button @click="departMember(m.id)" class="btn-ghost danger">Depart</button></template>
                </template>
              </li>
            </ul>
          </div>
        </template>

      </template>
    </main>
  </div>

  <!-- Setup (before currency set) -->
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

/* month bar */
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

/* balance cards */
.balance-row { display: flex; gap: 12px; margin-bottom: 20px; }
.balance-card { flex: 1; background: var(--card); border-radius: var(--radius); padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; border: 0.5px solid var(--border); }
.balance-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.balance-value { font-size: 24px; font-weight: 500; color: var(--text); }
.balance-value.negative { color: var(--danger); }
.balance-total .balance-value { color: var(--accent); }

/* cards */
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

/* orbit ring */
.orbit-ring { width: 24px; height: 24px; flex-shrink: 0; }
.orbit-ring circle:last-child { transition: stroke-dashoffset 0.6s ease; }
.gp-pct { margin-left: auto; font-size: 12px; color: var(--ice); font-weight: 500; }

/* leftover */
.leftover-row { display: flex; gap: 24px; flex-wrap: wrap; }
.leftover-col { flex: 1; min-width: 200px; }
.lcol-name { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px; }
.lcol-line { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
.lcol-line span:first-child { color: var(--text2); }
.lcol-line span:last-child { color: var(--text); font-variant-numeric: tabular-nums; }
.lcol-divider { height: 0.5px; background: var(--border); margin: 6px 0; }
.lcol-result { font-weight: 500; }
.lcol-result span:last-child { color: var(--accent); }
.muted { color: var(--muted); }
.lcol-line .muted { color: var(--muted); }

/* pages */
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

/* setup */
.setup-outer { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.setup-card { max-width: 400px; }
.setup-card h2 { margin: 0 0 4px; font-weight: 500; }
</style>

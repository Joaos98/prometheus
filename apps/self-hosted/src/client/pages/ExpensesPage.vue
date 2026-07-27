<script setup lang="ts">
import type { Expense, ExpenseAmount, MemberSummary } from "@prometheus/engine";
import { ref } from "vue";

const props = defineProps<{
  members: { id: string; name: string }[];
  expenses: Expense[];
  currency: string;
  displayMonth: string;
  currentMonth: string;
  expenseAmounts: ExpenseAmount[];
  summaryMembers: MemberSummary[];
  api: {
    submitExpense(name: string, participants: string[], splitRule: Record<string, unknown>, effectiveFrom: string, oneOff: boolean): Promise<Expense>;
    submitExpenseAmount(eid: string, amountCents: number): Promise<void>;
    endExpense(id: string, eff: string): Promise<void>;
    changeExpenseSplit(eid: string, rule: Record<string, unknown>, eff: string): Promise<void>;
    changeExpenseParticipants(eid: string, participants: string[], eff: string): Promise<void>;
  };
  backdateWarning: (eff: string) => string | null;
  formatCurrency: (cents: number, currency: string) => string;
}>();

const showForm = ref(false);
const newExpenseName = ref(""); const newExpenseParticipants = ref<string[]>([]); const newExpenseSplitRule = ref("even");
const newExpenseCustomMode = ref("percent"); const newExpenseCustomValues = ref<Record<string, number>>({});
const newExpenseOneOff = ref(false); const newExpenseEffectiveFrom = ref("");
const amountValue = ref(""); const expandedExpense = ref<string | null>(null);
const endingExpenseId = ref<string | null>(null); const endingEff = ref("");

const showChangeSplit = ref<string | null>(null); const changeSplitRule = ref("even"); const changeSplitEff = ref("");
const showChangeParticipants = ref<string | null>(null); const changeParticipantsList = ref<string[]>([]); const changeParticipantsEff = ref("");

function memberName(id: string) { return props.members.find(m => m.id === id)?.name ?? id; }
function activeExpenses() { return props.expenses.filter(e => e.effectiveFrom <= props.displayMonth && (e.endedFrom === undefined || e.endedFrom > props.displayMonth)); }
function hasAmount(eid: string) { return props.expenseAmounts.some(a => a.expenseId === eid && a.month === props.displayMonth); }
function amountCents(eid: string) { return props.expenseAmounts.find(a => a.expenseId === eid && a.month === props.displayMonth)?.amountCents; }
function shares(eid: string) { return props.summaryMembers.flatMap(m => m.shares.filter(s => s.expenseId === eid).map(s => ({ memberId: m.memberId, name: m.name, amountCents: s.amountCents }))); }
function toggleParticipant(id: string) { const i = newExpenseParticipants.value.indexOf(id); if (i >= 0) newExpenseParticipants.value.splice(i, 1); else newExpenseParticipants.value.push(id); }

async function submit() {
  const n = newExpenseName.value.trim(); const p = [...newExpenseParticipants.value]; const eff = newExpenseEffectiveFrom.value;
  if (!n || p.length === 0 || !eff) return;
  let r: Record<string, unknown>;
  if (newExpenseSplitRule.value === "custom") r = { method: "custom", mode: newExpenseCustomMode.value, values: { ...newExpenseCustomValues.value } };
  else r = { method: newExpenseSplitRule.value };
  await props.api.submitExpense(n, p, r, eff, newExpenseOneOff.value);
  newExpenseName.value = ""; newExpenseParticipants.value = []; newExpenseCustomValues.value = {}; newExpenseOneOff.value = false; newExpenseEffectiveFrom.value = ""; showForm.value = false;
}
async function submitAmount(eid: string) { const a = parseFloat(amountValue.value); if (isNaN(a)) return; await props.api.submitExpenseAmount(eid, Math.round(a * 100)); amountValue.value = ""; }
async function doEndExpense(id: string) { await props.api.endExpense(id, endingEff.value); endingExpenseId.value = null; }
async function doChangeSplit(eid: string) { await props.api.changeExpenseSplit(eid, { method: changeSplitRule.value }, changeSplitEff.value); showChangeSplit.value = null; }
async function doChangeParticipants(eid: string) { await props.api.changeExpenseParticipants(eid, [...changeParticipantsList.value], changeParticipantsEff.value); showChangeParticipants.value = null; }
function openChangeSplit(e: Expense) { showChangeSplit.value = e.id; changeSplitRule.value = e.splitRule.method; changeSplitEff.value = ""; }
function openChangeParticipants(e: Expense) { showChangeParticipants.value = e.id; changeParticipantsList.value = [...e.participants]; changeParticipantsEff.value = ""; }
function toggleCP(id: string) { const i = changeParticipantsList.value.indexOf(id); if (i >= 0) changeParticipantsList.value.splice(i, 1); else changeParticipantsList.value.push(id); }
</script>

<template>
  <div class="page-header"><h2>Expenses</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="submit" class="add-form">
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
      <li v-for="e in activeExpenses()" :key="e.id" class="ov-row exp-row" :class="{ pending: !hasAmount(e.id) }">
        <div class="exp-main">
          <span :class="{ ended: e.endedFrom }">{{ e.name }}</span>
          <span v-if="hasAmount(e.id)" class="exp-amt">{{ formatCurrency(amountCents(e.id)!, currency) }}</span>
          <span v-else class="pending-badge">pending</span>
          <span class="muted">{{ e.splitRule.method === 'proportional' ? 'proportional' : e.splitRule.method }}</span>
          <span class="muted">&bull;</span>
          <span class="muted">{{ e.participants.map(memberName).join(', ') }}</span>
          <button @click="expandedExpense = expandedExpense === e.id ? null : e.id" class="btn-ghost">{{ expandedExpense === e.id ? 'Hide' : 'Details' }}</button>
        </div>
        <div v-if="expandedExpense === e.id" class="exp-det">
          <div v-if="shares(e.id).length > 0">
            <div v-for="s in shares(e.id)" :key="s.memberId" class="share-row"><span>{{ s.name }}</span><span>{{ formatCurrency(s.amountCents, currency) }}</span></div>
            <div class="share-row share-total"><span>Total</span><span>{{ formatCurrency(shares(e.id).reduce((sum, s) => sum + s.amountCents, 0), currency) }}</span></div>
          </div>
          <template v-if="!hasAmount(e.id)">
            <input v-model="amountValue" placeholder="$" type="number" step="0.01" min="0" class="input input-xs" />
            <button @click="submitAmount(e.id)" class="btn-accent">Save Amount</button>
          </template>
          <div v-if="e.endedFrom === undefined" class="exp-actions">
            <button @click="openChangeSplit(e)" class="btn-ghost">Change Split</button>
            <button @click="openChangeParticipants(e)" class="btn-ghost">Change Participants</button>
            <template v-if="endingExpenseId === e.id">
              <input v-model="endingEff" placeholder="End YYYY-MM" size="7" class="input input-xs" />
              <button @click="doEndExpense(e.id)" class="btn-ghost danger">Confirm End</button>
              <button @click="endingExpenseId = null" class="btn-ghost">Cancel</button>
            </template>
            <button v-else @click="endingExpenseId = e.id" class="btn-ghost danger">End</button>
          </div>
          <div v-if="showChangeSplit === e.id" class="ch-form">
            <select v-model="changeSplitRule" class="input input-sm"><option value="even">Even</option><option value="proportional">Proportional</option></select> From <input v-model="changeSplitEff" placeholder="YYYY-MM" size="7" class="input input-xs" />
            <span v-if="backdateWarning(changeSplitEff)" class="pending-badge">{{ backdateWarning(changeSplitEff) }}</span>
            <button @click="doChangeSplit(e.id)" class="btn-accent">Confirm</button><button @click="showChangeSplit = null" class="btn-ghost">Cancel</button>
          </div>
          <div v-if="showChangeParticipants === e.id" class="ch-form">
            <label v-for="m in members" :key="m.id" class="check"><input type="checkbox" :checked="changeParticipantsList.includes(m.id)" @change="toggleCP(m.id)" /> {{ m.name }}</label>
            From <input v-model="changeParticipantsEff" placeholder="YYYY-MM" size="7" class="input input-xs" />
            <span v-if="backdateWarning(changeParticipantsEff)" class="pending-badge">{{ backdateWarning(changeParticipantsEff) }}</span>
            <button @click="doChangeParticipants(e.id)" class="btn-accent">Confirm</button><button @click="showChangeParticipants = null" class="btn-ghost">Cancel</button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

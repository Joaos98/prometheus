<script setup lang="ts">
import type { Expense } from "@prometheus/engine";
import { ref } from "vue";
import MonthPicker from "../components/MonthPicker.vue";
import ParticipantPicker from "../components/ParticipantPicker.vue";
import InfoTip from "../components/InfoTip.vue";

const props = defineProps<{
  members: { id: string; name: string }[];
  expenses: Expense[];
  currency: string;
  displayMonth: string;
  currentMonth: string;
  expenseAmounts: { expenseId: string; month: string; amountCents: number }[];
  summaryMembers: { shares: { expenseId: string; amountCents: number }[]; memberId: string; name: string }[];
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
const newExpenseCategory = ref("");
const amountValue = ref(""); const expandedExpense = ref<string | null>(null);
const endingExpenseId = ref<string | null>(null); const endingEff = ref("");

const showChangeSplit = ref<string | null>(null); const changeSplitRule = ref("even"); const changeSplitEff = ref("");
const showChangeParticipants = ref<string | null>(null); const changeParticipantsList = ref<string[]>([]); const changeParticipantsEff = ref("");

function memberName(id: string) { return props.members.find(m => m.id === id)?.name ?? id; }
function activeExpenses() { return props.expenses.filter(e => e.effectiveFrom <= props.displayMonth && (e.endedFrom === undefined || e.endedFrom > props.displayMonth)); }
function hasAmount(eid: string) { return props.expenseAmounts.some(a => a.expenseId === eid && a.month === props.displayMonth); }
function amountCents(eid: string) { return props.expenseAmounts.find(a => a.expenseId === eid && a.month === props.displayMonth)?.amountCents; }
function shares(eid: string) { return props.summaryMembers.flatMap(m => m.shares.filter(s => s.expenseId === eid).map(s => ({ memberId: m.memberId, name: m.name, amountCents: s.amountCents }))); }

async function submit() {
  const n = newExpenseName.value.trim(); const p = [...newExpenseParticipants.value]; const eff = newExpenseEffectiveFrom.value;
  if (!n || p.length === 0 || !eff) return;
  let r: Record<string, unknown>;
  if (newExpenseSplitRule.value === "custom") r = { method: "custom", mode: newExpenseCustomMode.value, values: { ...newExpenseCustomValues.value } };
  else r = { method: newExpenseSplitRule.value };
  await props.api.submitExpense(n, p, r, eff, newExpenseOneOff.value, newExpenseCategory.value.trim() || undefined);
  newExpenseName.value = ""; newExpenseParticipants.value = []; newExpenseCustomValues.value = {}; newExpenseOneOff.value = false; newExpenseEffectiveFrom.value = ""; newExpenseCategory.value = ""; showForm.value = false;
}
async function submitAmount(eid: string) { const a = parseFloat(amountValue.value); if (isNaN(a)) return; await props.api.submitExpenseAmount(eid, Math.round(a * 100)); amountValue.value = ""; }
async function doEndExpense(id: string) { await props.api.endExpense(id, endingEff.value); endingExpenseId.value = null; }
async function doChangeSplit(eid: string) { await props.api.changeExpenseSplit(eid, { method: changeSplitRule.value }, changeSplitEff.value); showChangeSplit.value = null; }
async function doChangeParticipants(eid: string) { await props.api.changeExpenseParticipants(eid, [...changeParticipantsList.value], changeParticipantsEff.value); showChangeParticipants.value = null; }
function openChangeSplit(e: Expense) { showChangeSplit.value = e.id; changeSplitRule.value = e.splitRule.method; changeSplitEff.value = ""; }
function openChangeParticipants(e: Expense) { showChangeParticipants.value = e.id; changeParticipantsList.value = [...e.participants]; changeParticipantsEff.value = ""; }

</script>

<template>
  <div class="page-header"><h2>Expenses</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="submit" class="add-form">
    <div class="field"><span class="field-label">Name</span><input v-model="newExpenseName" placeholder="e.g. Rent" class="input" /></div>
    <div class="field"><span class="field-label">Participants</span><ParticipantPicker :members="members" v-model="newExpenseParticipants" /></div>
    <div class="field"><span class="field-label">Split method</span><select v-model="newExpenseSplitRule" class="input"><option value="even">Even</option><option value="proportional">Proportional to Income</option><option value="custom">Custom</option></select></div>
    <template v-if="newExpenseSplitRule === 'custom'">
      <select v-model="newExpenseCustomMode" class="input input-sm"><option value="percent">Percent</option><option value="amount">Amount</option></select>
      <div v-for="m in members" :key="m.id" class="cv-row"><label>{{ m.name }}</label><input type="number" :placeholder="newExpenseCustomMode === 'percent' ? '%' : '$'" min="0" :value="newExpenseCustomValues[m.id] ?? ''" class="input input-sm" @input="newExpenseCustomValues[m.id] = parseFloat(($event.target as HTMLInputElement).value) || 0" /></div>
    </template>
    <label class="check"><input type="checkbox" v-model="newExpenseOneOff" /> One-off <InfoTip tip="Applies to a single month only; does not carry forward." /></label>
    <div class="field"><span class="field-label">Category (optional)</span><input v-model="newExpenseCategory" list="expense-cats" placeholder="e.g. Housing" class="input" /></div>
    <div class="field"><span class="field-label">From</span><MonthPicker v-model="newExpenseEffectiveFrom" placeholder="From" /></div>
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div class="card" v-if="activeExpenses().length > 0">
    <h3 class="card-label">Active this Month</h3>
    <ul class="ov-list">
      <li v-for="e in activeExpenses()" :key="e.id" class="ov-row exp-row">
        <div class="exp-main">
          <span :class="{ ended: e.endedFrom }">{{ e.name }}<span v-if="!hasAmount(e.id)" class="pending-label">pending</span></span>
          <span v-if="hasAmount(e.id)" class="exp-amt">{{ formatCurrency(amountCents(e.id)!, currency) }}</span>
          <span class="muted">{{ e.splitRule.method }}</span>
          <span class="muted">|</span>
          <span class="muted">{{ e.participants.map(memberName).join(', ') }}</span>
          <button @click="expandedExpense = expandedExpense === e.id ? null : e.id" class="btn-ghost">{{ expandedExpense === e.id ? 'Hide' : 'Details' }}</button>
        </div>
        <div v-if="expandedExpense === e.id" class="exp-det">
          <div v-if="shares(e.id).length > 0">
            <div v-for="s in shares(e.id)" :key="s.memberId" class="share-row"><span>{{ s.name }}</span><span>{{ formatCurrency(s.amountCents, currency) }}</span></div>
            <div class="share-row share-total"><span>Total</span><span>{{ formatCurrency(shares(e.id).reduce((sum, s) => sum + s.amountCents, 0), currency) }}</span></div>
          </div>
          <template v-if="!hasAmount(e.id)">
            <input v-model="amountValue" placeholder="0.00" type="number" step="0.01" min="0" class="input input-xs" />
            <button @click="submitAmount(e.id)" class="btn-accent">Save Amount</button>
          </template>
          <div v-if="e.endedFrom === undefined" class="exp-actions">
            <button @click="openChangeSplit(e)" class="btn-ghost">Change Split</button>
            <button @click="openChangeParticipants(e)" class="btn-ghost">Change Participants</button>
            <template v-if="endingExpenseId === e.id">
              <MonthPicker v-model="endingEff" placeholder="Ended in" />
              <button @click="doEndExpense(e.id)" class="btn-ghost danger">Confirm End</button>
              <button @click="endingExpenseId = null" class="btn-ghost">Cancel</button>
            </template>
            <button v-else @click="endingExpenseId = e.id" class="btn-ghost danger">End</button>
          </div>
          <div v-if="showChangeSplit === e.id" class="ch-form">
            <select v-model="changeSplitRule" class="input input-sm"><option value="even">Even</option><option value="proportional">Proportional</option></select> From <MonthPicker v-model="changeSplitEff" placeholder="From" />
            <span v-if="backdateWarning(changeSplitEff)" class="pending-badge">{{ backdateWarning(changeSplitEff) }}</span>
            <button @click="doChangeSplit(e.id)" class="btn-accent">Confirm</button><button @click="showChangeSplit = null" class="btn-ghost">Cancel</button>
          </div>
          <div v-if="showChangeParticipants === e.id" class="ch-form">
            <ParticipantPicker :members="members" v-model="changeParticipantsList" />
            From <MonthPicker v-model="changeParticipantsEff" placeholder="From" />
            <span v-if="backdateWarning(changeParticipantsEff)" class="pending-badge">{{ backdateWarning(changeParticipantsEff) }}</span>
            <button @click="doChangeParticipants(e.id)" class="btn-accent">Confirm</button><button @click="showChangeParticipants = null" class="btn-ghost">Cancel</button>
          </div>
        </div>
      </li>
    </ul>
  </div>
  <datalist id="expense-cats">
    <option v-for="c in [...new Set(expenses.map(e => e.category).filter(Boolean))]" :key="c" :value="c" />
  </datalist>
</template>

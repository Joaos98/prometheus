<script setup lang="ts">
import type { ExpenseTemplate, IncomeProfile } from "@prometheus/data";
import type { MonthlySummary } from "@prometheus/engine";
import { ref } from "vue";

const props = defineProps<{
  members: { id: string; name: string }[];
  templates: ExpenseTemplate[];
  summary: MonthlySummary;
  currency: string;
  displayMonth: string;
  profiles: IncomeProfile[];
  api: {
    addExpenseTemplate(name: string, defaultParticipants: string[], defaultSplitRule: Record<string, unknown>, category?: string): Promise<ExpenseTemplate>;
    endExpenseTemplate(id: string): Promise<unknown>;
    upsertExpenseSnapshot(expenseId: string, month: string, amountCents: number, participants: string[], splitRule: Record<string, unknown>): Promise<unknown>;
  };
}>();

const showForm = ref(false);
const newName = ref(""); const newParticipants = ref<string[]>([]); const newSplitRule = ref("even");
const newCategory = ref("");
const amountValues = ref<Record<string, string>>({});
const expanded = ref<string | null>(null);
const propagateAmount = ref(false);

const fmt = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: props.currency }).format(cents / 100);
const fmtCur = (cents: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);

function activeTemplates() { return props.templates.filter(t => t.active); }
function snapshotForTemplate(tid: string) { return props.summary.members[0]?.shares.find(s => s.expenseId === tid); }
function toggleP(mid: string) { const i = newParticipants.value.indexOf(mid); if (i >= 0) newParticipants.value.splice(i, 1); else newParticipants.value.push(mid); }
function memberName(id: string) { return props.members.find(m => m.id === id)?.name ?? id; }

async function submit() {
  if (!newName.value.trim() || newParticipants.value.length === 0) return;
  await props.api.addExpenseTemplate(newName.value.trim(), [...newParticipants.value], { method: newSplitRule.value }, newCategory.value.trim() || undefined);
  newName.value = ""; newParticipants.value = []; newCategory.value = ""; showForm.value = false;
}

async function saveAmount(tid: string) {
  const a = parseFloat(amountValues.value[tid] ?? "");
  if (isNaN(a)) return;
  const t = props.templates.find(tp => tp.id === tid);
  await props.api.upsertExpenseSnapshot(tid, props.displayMonth, Math.round(a * 100), t?.defaultParticipants ?? [], t?.defaultSplitRule ?? { method: "even" });
  if (propagateAmount.value) await props.api.propagateExpense(tid, props.displayMonth);
  delete amountValues.value[tid];
  propagateAmount.value = false;
}
</script>

<template>
  <div class="page-header"><h2>Expenses</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add Template' }}</button></div>

  <form v-if="showForm" @submit.prevent="submit" class="add-form">
    <div class="field"><span class="field-label">Name</span><input v-model="newName" placeholder="e.g. Rent" class="input" /></div>
    <fieldset class="check-group"><legend>Participants</legend><label v-for="m in members" :key="m.id" class="check"><input type="checkbox" @change="toggleP(m.id)" /> {{ m.name }}</label></fieldset>
    <select v-model="newSplitRule" class="input"><option value="even">Even</option><option value="proportional">Proportional</option><option value="custom">Custom</option></select>
    <input v-model="newCategory" placeholder="Category (optional)" class="input input-sm" />
    <button type="submit" class="btn-accent">Save</button>
  </form>

  <div class="card" v-if="activeTemplates().length > 0">
    <h3 class="card-label">Active this Month</h3>
    <ul class="ov-list">
      <li v-for="t in activeTemplates()" :key="t.id" class="ov-row exp-row">
        <div class="exp-main">
          <span>{{ t.name }}</span>
          <span class="muted">{{ t.defaultSplitRule.method === 'proportional' ? 'proportional' : t.defaultSplitRule.method }}</span>
          <span class="muted">|</span>
          <span class="muted">{{ t.defaultParticipants.map(memberName).join(', ') }}</span>
          <span v-if="props.summary.pendingExpenses?.some(p => p.expenseId === t.id)" class="pending-label">pending</span>
          <button @click="expanded = expanded === t.id ? null : t.id" class="btn-ghost">{{ expanded === t.id ? 'Hide' : 'Details' }}</button>
        </div>
        <div v-if="expanded === t.id" class="exp-det">
          <template v-if="props.summary.pendingExpenses?.some(p => p.expenseId === t.id)">
            <input v-model="amountValues[t.id]" placeholder="0.00" type="number" step="0.01" min="0" class="input input-xs" />
            <button @click="saveAmount(t.id)" class="btn-accent">Save Amount</button>
            <label class="check" style="margin-left:4px"><input type="checkbox" v-model="propagateAmount" /> Apply to forward months</label>
          </template>
          <template v-else>
            <div v-for="m in summary.members" :key="m.memberId" class="share-row">
              <span>{{ m.name }}</span>
              <span>{{ fmtCur(m.shares.find(s => s.expenseId === t.id)?.amountCents ?? 0, summary.currency) }}</span>
            </div>
          </template>
          <div class="exp-actions">
            <button @click="props.api.endExpenseTemplate(t.id)" class="btn-ghost danger">End Template</button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

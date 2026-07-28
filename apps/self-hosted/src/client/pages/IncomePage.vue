<script setup lang="ts">
import type { IncomeSource, Member } from "@prometheus/engine";
import { ref } from "vue";
import MonthPicker from "../components/MonthPicker.vue";
import InfoTip from "../components/InfoTip.vue";

const props = defineProps<{
  members: Member[];
  incomeSources: IncomeSource[];
  currency: string;
  displayMonth: string;
  currentMonth: string;
  api: {
    submitIncome(name: string, memberId: string, amountCents: number, effectiveFrom: string, restrictedUse: boolean, oneOff: boolean, category?: string): Promise<IncomeSource>;
    updateIncomeAmount(id: string, amountCents: number, effectiveFrom: string): Promise<void>;
    endIncome(id: string, eff: string): Promise<void>;
    submitMember(name: string, joinedFrom?: string): Promise<Member>;
  };
}>();

const showForm = ref(false);
const newSourceMemberId = ref("");
const newSourceName = ref("");
const newSourceAmount = ref("");
const newSourceEffectiveFrom = ref("");
const newSourceRestricted = ref(false);
const newSourceOneOff = ref(false);
const newSourceCategory = ref("");
const editingSourceId = ref<string | null>(null);
const editingSourceAmount = ref("");
const editingSourceEffectiveFrom = ref("");
const endingSourceEff = ref("");
const endingSourceId = ref<string | null>(null);

const formatCurrency = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: props.currency }).format(cents / 100);
function sourcesForMember(mid: string) { return props.incomeSources.filter(s => s.memberId === mid); }
const latestAmount = (s: IncomeSource) => { const a = [...s.timeline].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)); return a[0]?.amountCents ?? 0; };

async function submit() {
  const a = parseFloat(newSourceAmount.value);
  if (!newSourceName.value.trim() || !newSourceMemberId.value || isNaN(a) || !newSourceEffectiveFrom.value) return;
  await props.api.submitIncome(newSourceName.value.trim(), newSourceMemberId.value, Math.round(a * 100), newSourceEffectiveFrom.value, newSourceRestricted.value, newSourceOneOff.value, newSourceCategory.value.trim() || undefined);
  newSourceName.value = ""; newSourceAmount.value = ""; newSourceEffectiveFrom.value = ""; newSourceOneOff.value = false; newSourceRestricted.value = false; newSourceCategory.value = ""; showForm.value = false;
}
function startEdit(s: IncomeSource) { editingSourceId.value = s.id; editingSourceAmount.value = String(latestAmount(s) / 100); editingSourceEffectiveFrom.value = ""; }
async function commitEdit() {
  const a = parseFloat(editingSourceAmount.value);
  if (!editingSourceId.value || isNaN(a) || !editingSourceEffectiveFrom.value) return;
  await props.api.updateIncomeAmount(editingSourceId.value, Math.round(a * 100), editingSourceEffectiveFrom.value);
  editingSourceId.value = null;
}
async function endSource(id: string) { await props.api.endIncome(id, endingSourceEff.value); endingSourceId.value = null; endingSourceEff.value = ""; }
</script>

<template>
  <div class="page-header"><h2>Income</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="submit" class="add-form">
    <select v-model="newSourceMemberId" class="input"><option value="" disabled>Member</option><option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option></select>
    <input v-model="newSourceName" placeholder="Source name" class="input" />
    <input v-model="newSourceAmount" placeholder="Amount" type="number" step="0.01" min="0" class="input" />
    <MonthPicker v-model="newSourceEffectiveFrom" placeholder="From" />
    <div class="field"><span class="field-label">Category (optional)</span><input v-model="newSourceCategory" list="income-cats" placeholder="e.g. Salary" class="input" /></div>
    <label class="check"><input type="checkbox" v-model="newSourceRestricted" /> Restricted <InfoTip tip="Excluded from spendable income and proportional split calculations; shown separately on the dashboard." /></label>
    <label class="check"><input type="checkbox" v-model="newSourceOneOff" /> One-off <InfoTip tip="Applies to a single month only; does not carry forward." /></label>
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div v-for="m in members" :key="m.id" class="card">
    <h3 class="card-label" v-if="sourcesForMember(m.id).length > 0">{{ m.name }}</h3>
    <ul class="ov-list">
      <li v-for="s in sourcesForMember(m.id)" :key="s.id" class="ov-row">
        <template v-if="editingSourceId === s.id">
          <input v-model="editingSourceAmount" placeholder="Amount" class="input input-sm" />
          <MonthPicker v-model="editingSourceEffectiveFrom" placeholder="From" />
          <button @click="commitEdit()" class="btn-ghost">Save</button>
          <button @click="editingSourceId = null" class="btn-ghost">Cancel</button>
        </template>
        <template v-else>
          <span :class="{ ended: s.endedFrom }">{{ s.name }}</span>
          <span>{{ formatCurrency(latestAmount(s)) }}</span>
          <span v-if="s.restrictedUse" class="tag">restricted</span>
          <button @click="startEdit(s)" class="btn-ghost">Update</button>
          <template v-if="s.endedFrom === undefined">
            <template v-if="endingSourceId === s.id">
              <MonthPicker v-model="endingSourceEff" placeholder="Ended in" />
              <button @click="endSource(s.id)" class="btn-ghost danger">Confirm End</button>
              <button @click="endingSourceId = null" class="btn-ghost">Cancel</button>
            </template>
            <button v-else @click="endingSourceId = s.id" class="btn-ghost danger">End</button>
          </template>
        </template>
      </li>
    </ul>
  </div>
  <datalist id="income-cats">
    <option v-for="c in [...new Set(incomeSources.map(s => s.category).filter(Boolean))]" :key="c" :value="c" />
  </datalist>
</template>

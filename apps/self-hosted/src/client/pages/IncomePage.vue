<script setup lang="ts">
import type { IncomeSource, Member } from "@prometheus/engine";

const props = defineProps<{
  members: Member[];
  incomeSources: IncomeSource[];
  currency: string;
  showForm: boolean;
  newSourceMemberId: string;
  newSourceName: string;
  newSourceAmount: string;
  newSourceEffectiveFrom: string;
  newSourceRestricted: boolean;
  newSourceOneOff: boolean;
  editingSourceId: string | null;
  editingSourceAmount: string;
  editingSourceEffectiveFrom: string;
  endingSourceEffectiveFrom: Record<string, string>;
  endingSource: string | null;
  sourcesForMember: (mid: string) => IncomeSource[];
  latestAmount: (s: IncomeSource) => number;
  formatCurrency: (cents: number, currency: string) => string;
}>();

const emit = defineEmits<{
  (e: 'toggleForm'): void;
  (e: 'submitIncome'): void;
  (e: 'startEdit', source: IncomeSource): void;
  (e: 'commitEdit'): void;
  (e: 'endSource', id: string, eff: string): void;
  (e: 'cancelEdit'): void;
  (e: 'cancelEnd'): void;
  (e: 'update:newSourceMemberId', v: string): void;
  (e: 'update:newSourceName', v: string): void;
  (e: 'update:newSourceAmount', v: string): void;
  (e: 'update:newSourceEffectiveFrom', v: string): void;
  (e: 'update:newSourceRestricted', v: boolean): void;
  (e: 'update:newSourceOneOff', v: boolean): void;
  (e: 'update:editingSourceAmount', v: string): void;
  (e: 'update:editingSourceEffectiveFrom', v: string): void;
  (e: 'update:endingSourceEffectiveFrom', id: string, v: string): void;
  (e: 'startEndSource', id: string): void;
}>();
</script>

<template>
  <div class="page-header"><h2>Income</h2><button @click="emit('toggleForm')" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="emit('submitIncome')" class="add-form">
    <select :value="newSourceMemberId" @change="emit('update:newSourceMemberId', ($event.target as HTMLSelectElement).value)" class="input"><option value="" disabled>Member</option><option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option></select>
    <input :value="newSourceName" @input="emit('update:newSourceName', ($event.target as HTMLInputElement).value)" placeholder="Source name" class="input" />
    <input :value="newSourceAmount" @input="emit('update:newSourceAmount', ($event.target as HTMLInputElement).value)" placeholder="Amount" type="number" step="0.01" min="0" class="input" />
    <input :value="newSourceEffectiveFrom" @input="emit('update:newSourceEffectiveFrom', ($event.target as HTMLInputElement).value)" placeholder="From YYYY-MM" class="input input-sm" />
    <label class="check"><input type="checkbox" :checked="newSourceRestricted" @change="emit('update:newSourceRestricted', ($event.target as HTMLInputElement).checked)" /> Restricted</label>
    <label class="check"><input type="checkbox" :checked="newSourceOneOff" @change="emit('update:newSourceOneOff', ($event.target as HTMLInputElement).checked)" /> One-off</label>
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div v-for="m in members" :key="m.id" class="card">
    <h3 class="card-label" v-if="sourcesForMember(m.id).length > 0">{{ m.name }}</h3>
    <ul class="ov-list">
      <li v-for="s in sourcesForMember(m.id)" :key="s.id" class="ov-row">
        <template v-if="editingSourceId === s.id">
          <input :value="editingSourceAmount" @input="emit('update:editingSourceAmount', ($event.target as HTMLInputElement).value)" placeholder="Amount" class="input input-sm" />
          <input :value="editingSourceEffectiveFrom" @input="emit('update:editingSourceEffectiveFrom', ($event.target as HTMLInputElement).value)" placeholder="From YYYY-MM" class="input input-sm" />
          <button @click="emit('commitEdit')" class="btn-ghost">Save</button>
          <button @click="emit('cancelEdit')" class="btn-ghost">Cancel</button>
        </template>
        <template v-else>
          <span :class="{ ended: s.endedFrom }">{{ s.name }}</span>
          <span>{{ formatCurrency(latestAmount(s), currency) }}</span>
          <span v-if="s.restrictedUse" class="tag">restricted</span>
          <button @click="emit('startEdit', s)" class="btn-ghost">Update</button>
          <template v-if="s.endedFrom === undefined">
            <template v-if="endingSource === s.id">
              <input :value="endingSourceEffectiveFrom[s.id] ?? ''" @input="emit('update:endingSourceEffectiveFrom', s.id, ($event.target as HTMLInputElement).value)" placeholder="End YYYY-MM" size="7" class="input input-xs" />
              <button @click="emit('endSource', s.id, endingSourceEffectiveFrom[s.id] ?? '')" class="btn-ghost danger">Confirm End</button>
              <button @click="emit('cancelEnd')" class="btn-ghost">Cancel</button>
            </template>
            <button v-else @click="emit('startEndSource', s.id)" class="btn-ghost danger">End</button>
          </template>
        </template>
      </li>
    </ul>
  </div>
</template>

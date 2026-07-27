<script setup lang="ts">
import type { Expense, Member } from "@prometheus/engine";

const props = defineProps<{
  members: Member[];
  expenses: Expense[];
  currency: string;
  displayMonth: string;
  showForm: boolean;
  newExpenseName: string;
  newExpenseParticipants: string[];
  newExpenseSplitRule: string;
  newExpenseCustomMode: string;
  newExpenseCustomValues: Record<string, number>;
  newExpenseOneOff: boolean;
  newExpenseEffectiveFrom: string;
  expenseAmountValues: Record<string, string>;
  endingExpenseEffectiveFrom: Record<string, string>;
  showChangeSplit: string | null;
  changeSplitRule: string;
  changeSplitEff: string;
  showChangeParticipants: string | null;
  changeParticipantsList: string[];
  changeParticipantsEff: string;
  expandedExpense: string | null;
  endingExpense: string | null;
  activeExpenses: () => Expense[];
  expenseHasAmount: (id: string) => boolean;
  expenseAmountCents: (id: string) => number | undefined;
  expenseShares: (id: string) => { memberId: string; name: string; amountCents: number }[];
  memberName: (id: string) => string;
  backdateWarning: (eff: string) => string | null;
  formatCurrency: (cents: number, currency: string) => string;
}>();

const emit = defineEmits<{
  (e: 'toggleForm'): void;
  (e: 'submitExpense'): void;
  (e: 'submitExpenseAmount', id: string): void;
  (e: 'endExpense', id: string): void;
  (e: 'submitChangeSplit', id: string): void;
  (e: 'submitChangeParticipants', id: string): void;
  (e: 'toggleParticipant', id: string): void;
  (e: 'update:newExpenseName', v: string): void;
  (e: 'update:newExpenseSplitRule', v: string): void;
  (e: 'update:newExpenseCustomMode', v: string): void;
  (e: 'update:newExpenseCustomValues', id: string, v: number): void;
  (e: 'update:newExpenseOneOff', v: boolean): void;
  (e: 'update:newExpenseEffectiveFrom', v: string): void;
  (e: 'update:expenseAmountValues', id: string, v: string): void;
  (e: 'update:endingExpenseEffectiveFrom', id: string, v: string): void;
  (e: 'update:changeSplitRule', v: string): void;
  (e: 'update:changeSplitEff', v: string): void;
  (e: 'update:changeParticipantsEff', v: string): void;
  (e: 'toggleChangeParticipants', id: string, checked: boolean): void;
  (e: 'openChangeSplit', id: string, rule: string): void;
  (e: 'openChangeParticipants', id: string, list: string[]): void;
  (e: 'closeChangeSplit'): void;
  (e: 'closeChangeParticipants'): void;
  (e: 'toggleDetails', id: string): void;
  (e: 'startEndExpense', id: string): void;
  (e: 'cancelEndExpense'): void;
}>();
</script>

<template>
  <div class="page-header"><h2>Expenses</h2><button @click="emit('toggleForm')" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="emit('submitExpense')" class="add-form">
    <input :value="newExpenseName" @input="emit('update:newExpenseName', ($event.target as HTMLInputElement).value)" placeholder="Expense name" class="input" />
    <fieldset class="check-group"><legend>Participants</legend><label v-for="m in members" :key="m.id" class="check"><input type="checkbox" :value="m.id" @change="emit('toggleParticipant', m.id)" /> {{ m.name }}</label></fieldset>
    <select :value="newExpenseSplitRule" @change="emit('update:newExpenseSplitRule', ($event.target as HTMLSelectElement).value)" class="input"><option value="even">Even</option><option value="proportional">Proportional to Income</option><option value="custom">Custom</option></select>
    <template v-if="newExpenseSplitRule === 'custom'">
      <select :value="newExpenseCustomMode" @change="emit('update:newExpenseCustomMode', ($event.target as HTMLSelectElement).value)" class="input input-sm"><option value="percent">Percent</option><option value="amount">Amount</option></select>
      <div v-for="m in members" :key="m.id" class="cv-row"><label>{{ m.name }}</label><input type="number" :placeholder="newExpenseCustomMode === 'percent' ? '%' : '$'" min="0" :value="newExpenseCustomValues[m.id] ?? ''" class="input input-sm" @input="emit('update:newExpenseCustomValues', m.id, parseFloat(($event.target as HTMLInputElement).value) || 0)" /></div>
    </template>
    <label class="check"><input type="checkbox" :checked="newExpenseOneOff" @change="emit('update:newExpenseOneOff', ($event.target as HTMLInputElement).checked)" /> One-off</label>
    <input :value="newExpenseEffectiveFrom" @input="emit('update:newExpenseEffectiveFrom', ($event.target as HTMLInputElement).value)" placeholder="From YYYY-MM" class="input input-sm" />
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div class="card" v-if="activeExpenses().length > 0">
    <h3 class="card-label">Active this Month</h3>
    <ul class="ov-list">
      <li v-for="e in activeExpenses()" :key="e.id" class="ov-row exp-row" :class="{ pending: !expenseHasAmount(e.id) }">
        <div class="exp-main">
          <span :class="{ ended: e.endedFrom }">{{ e.name }}</span>
          <span v-if="expenseHasAmount(e.id)" class="exp-amt">{{ formatCurrency(expenseAmountCents(e.id)!, currency) }}</span>
          <span v-else class="pending-badge">pending</span>
          <span class="muted">{{ e.splitRule.method === 'proportional' ? 'proportional' : e.splitRule.method }}</span>
          <span class="muted">&bull;</span>
          <span class="muted">{{ e.participants.map(memberName).join(', ') }}</span>
          <button @click="emit('toggleDetails', e.id)" class="btn-ghost">{{ expandedExpense === e.id ? 'Hide' : 'Details' }}</button>
        </div>
        <div v-if="expandedExpense === e.id" class="exp-det">
          <div v-if="expenseShares(e.id).length > 0"><div v-for="s in expenseShares(e.id)" :key="s.memberId" class="share-row"><span>{{ s.name }}</span><span>{{ formatCurrency(s.amountCents, currency) }}</span></div><div class="share-row share-total"><span>Total</span><span>{{ formatCurrency(expenseShares(e.id).reduce((sum, s) => sum + s.amountCents, 0), currency) }}</span></div></div>
          <template v-if="!expenseHasAmount(e.id)"><input :value="expenseAmountValues[e.id] ?? ''" @input="emit('update:expenseAmountValues', e.id, ($event.target as HTMLInputElement).value)" placeholder="$" type="number" step="0.01" min="0" class="input input-xs" /><button @click="emit('submitExpenseAmount', e.id)" class="btn-accent">Save</button></template>
          <div v-if="e.endedFrom === undefined" class="exp-actions">
            <button @click="emit('openChangeSplit', e.id, e.splitRule.method === 'even' ? 'even' : e.splitRule.method === 'proportional' ? 'proportional' : 'custom')" class="btn-ghost">Change Split</button>
            <button @click="emit('openChangeParticipants', e.id, e.participants)" class="btn-ghost">Change Participants</button>
            <template v-if="endingExpense === e.id">
              <input :value="endingExpenseEffectiveFrom[e.id] ?? ''" @input="emit('update:endingExpenseEffectiveFrom', e.id, ($event.target as HTMLInputElement).value)" placeholder="End YYYY-MM" size="7" class="input input-xs" />
              <button @click="emit('endExpense', e.id); emit('cancelEndExpense')" class="btn-ghost danger">Confirm End</button>
              <button @click="emit('cancelEndExpense')" class="btn-ghost">Cancel</button>
            </template>
            <button v-else @click="emit('startEndExpense', e.id)" class="btn-ghost danger">End</button>
          </div>
          <div v-if="showChangeSplit === e.id" class="ch-form">
            <select :value="changeSplitRule" @change="emit('update:changeSplitRule', ($event.target as HTMLSelectElement).value)" class="input input-sm"><option value="even">Even</option><option value="proportional">Proportional</option></select>
            From <input :value="changeSplitEff" @input="emit('update:changeSplitEff', ($event.target as HTMLInputElement).value)" placeholder="YYYY-MM" size="7" class="input input-xs" />
            <span v-if="backdateWarning(changeSplitEff)" class="pending-badge">{{ backdateWarning(changeSplitEff) }}</span>
            <button @click="emit('submitChangeSplit', e.id)" class="btn-accent">Confirm</button>
            <button @click="emit('closeChangeSplit')" class="btn-ghost">Cancel</button>
          </div>
          <div v-if="showChangeParticipants === e.id" class="ch-form">
            <label v-for="m in members" :key="m.id" class="check"><input type="checkbox" :checked="changeParticipantsList.includes(m.id)" @change="emit('toggleChangeParticipants', m.id, ($event.target as HTMLInputElement).checked)" /> {{ m.name }}</label>
            From <input :value="changeParticipantsEff" @input="emit('update:changeParticipantsEff', ($event.target as HTMLInputElement).value)" placeholder="YYYY-MM" size="7" class="input input-xs" />
            <span v-if="backdateWarning(changeParticipantsEff)" class="pending-badge">{{ backdateWarning(changeParticipantsEff) }}</span>
            <button @click="emit('submitChangeParticipants', e.id)" class="btn-accent">Confirm</button>
            <button @click="emit('closeChangeParticipants')" class="btn-ghost">Cancel</button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

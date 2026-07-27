<script setup lang="ts">
import type { GoalProgress, Member, SavingsGoal } from "@prometheus/engine";

defineProps<{
  members: Member[];
  goals: SavingsGoal[];
  currency: string;
  showForm: boolean;
  newGoalName: string;
  newGoalParticipants: string[];
  newGoalSplitRule: string;
  newGoalTarget: string;
  newGoalStartAmount: string;
  newGoalEffectiveFrom: string;
  goalContributionValues: Record<string, string>;
  endingGoalEffectiveFrom: Record<string, string>;
  endingGoal: string | null;
  goalProgress: GoalProgress[];
  goalProgressPercent: (gp: GoalProgress) => number;
  memberName: (id: string) => string;
  formatCurrency: (cents: number, currency: string) => string;
}>();

const emit = defineEmits<{
  (e: 'toggleForm'): void;
  (e: 'submitGoal'): void;
  (e: 'submitGoalContribution', id: string): void;
  (e: 'endGoal', id: string): void;
  (e: 'toggleGoalParticipant', id: string): void;
  (e: 'update:newGoalName', v: string): void;
  (e: 'update:newGoalSplitRule', v: string): void;
  (e: 'update:newGoalTarget', v: string): void;
  (e: 'update:newGoalStartAmount', v: string): void;
  (e: 'update:newGoalEffectiveFrom', v: string): void;
  (e: 'update:goalContributionValues', id: string, v: string): void;
  (e: 'update:endingGoalEffectiveFrom', id: string, v: string): void;
  (e: 'startEndGoal', id: string): void;
  (e: 'cancelEndGoal'): void;
}>();
</script>

<template>
  <div class="page-header"><h2>Goals</h2><button @click="emit('toggleForm')" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="emit('submitGoal')" class="add-form">
    <input :value="newGoalName" @input="emit('update:newGoalName', ($event.target as HTMLInputElement).value)" placeholder="Goal name" class="input" />
    <fieldset class="check-group"><legend>Participants</legend><label v-for="m in members" :key="m.id" class="check"><input type="checkbox" :value="m.id" @change="emit('toggleGoalParticipant', m.id)" /> {{ m.name }}</label></fieldset>
    <select :value="newGoalSplitRule" @change="emit('update:newGoalSplitRule', ($event.target as HTMLSelectElement).value)" class="input"><option value="even">Even</option><option value="proportional">Proportional</option></select>
    <input :value="newGoalTarget" @input="emit('update:newGoalTarget', ($event.target as HTMLInputElement).value)" placeholder="Target amount (optional)" type="number" step="0.01" min="0" class="input" />
    <input :value="newGoalStartAmount" @input="emit('update:newGoalStartAmount', ($event.target as HTMLInputElement).value)" placeholder="Start amount (optional)" type="number" step="0.01" min="0" class="input" />
    <input :value="newGoalEffectiveFrom" @input="emit('update:newGoalEffectiveFrom', ($event.target as HTMLInputElement).value)" placeholder="From YYYY-MM" class="input input-sm" />
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div class="card" v-if="goalProgress.length > 0">
    <h3 class="card-label">Progress</h3>
    <ul class="ov-list">
      <li v-for="gp in goalProgress" :key="gp.goalId" class="ov-row">
        <svg class="orbit-ring" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#262A38" stroke-width="3" /><circle cx="16" cy="16" r="13" fill="none" stroke="#7DC9E8" stroke-width="3" stroke-dasharray="81.7" :stroke-dashoffset="81.7 * (1 - goalProgressPercent(gp) / 100)" stroke-linecap="round" transform="rotate(-90 16 16)" /></svg>
        <span>{{ gp.goalName }}</span>
        <span class="muted" style="font-size:11px">{{ (goals.find(g => g.id === gp.goalId)?.participants ?? []).map(memberName).join(', ') }}</span>
        <span>{{ formatCurrency(gp.accumulatedCents, currency) }}<template v-if="gp.targetAmountCents !== undefined"> / {{ formatCurrency(gp.targetAmountCents, currency) }}</template></span>
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
          <input :value="goalContributionValues[g.id] ?? ''" @input="emit('update:goalContributionValues', g.id, ($event.target as HTMLInputElement).value)" placeholder="$" type="number" step="0.01" min="0" class="input input-xs" /><button @click="emit('submitGoalContribution', g.id)" class="btn-accent">Save</button>
          <template v-if="endingGoal === g.id">
            <input :value="endingGoalEffectiveFrom[g.id] ?? ''" @input="emit('update:endingGoalEffectiveFrom', g.id, ($event.target as HTMLInputElement).value)" placeholder="End YYYY-MM" size="7" class="input input-xs" />
            <button @click="emit('endGoal', g.id); emit('cancelEndGoal')" class="btn-ghost danger">Confirm End</button>
            <button @click="emit('cancelEndGoal')" class="btn-ghost">Cancel</button>
          </template>
          <button v-else @click="emit('startEndGoal', g.id)" class="btn-ghost danger">End</button>
        </template>
        <span v-else class="muted">ended {{ g.endedFrom }}</span>
      </li>
    </ul>
  </div>
</template>

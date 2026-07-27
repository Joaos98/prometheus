<script setup lang="ts">
import type { GoalProgress, Member, SavingsGoal } from "@prometheus/engine";
import { ref } from "vue";
import MonthPicker from "../components/MonthPicker.vue";
import ParticipantPicker from "../components/ParticipantPicker.vue";

const props = defineProps<{
  members: Member[];
  goals: SavingsGoal[];
  currency: string;
  displayMonth: string;
  currentMonth: string;
  goalProgress: GoalProgress[];
  pendingContributions: { itemId: string; itemName: string }[];
  api: {
    submitGoal(name: string, participants: string[], splitRule: Record<string, unknown>, targetAmountCents: number | undefined, startAmountCents: number | undefined, effectiveFrom: string): Promise<void>;
    submitGoalContribution(gid: string, amountCents: number): Promise<void>;
    endGoal(id: string, eff: string): Promise<void>;
  };
}>();

const showForm = ref(false);
const newGoalName = ref(""); const newGoalParticipants = ref<string[]>([]); const newGoalSplitRule = ref("even");
const newGoalTarget = ref(""); const newGoalStartAmount = ref(""); const newGoalEffectiveFrom = ref("");
const newGoalCategory = ref("");
const contributionValue = ref(""); const endingGoalId = ref<string | null>(null); const endingEffectiveFrom = ref("");

const formatCurrency = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: props.currency }).format(cents / 100);
function goalPct(gp: GoalProgress) { if (!gp.targetAmountCents || gp.targetAmountCents === 0) return 0; return Math.min(100, Math.round((gp.accumulatedCents / gp.targetAmountCents) * 100)); }
function isGoalPending(gid: string) { return props.pendingContributions.some(p => p.itemId === gid); }
function memberName(id: string) { return props.members.find(m => m.id === id)?.name ?? id; }

async function submit() {
  const n = newGoalName.value.trim(); const p = [...newGoalParticipants.value]; const eff = newGoalEffectiveFrom.value;
  if (!n || p.length === 0 || !eff) return;
  await props.api.submitGoal(n, p, { method: newGoalSplitRule.value },
    newGoalTarget.value ? Math.round(parseFloat(newGoalTarget.value) * 100) : undefined,
    newGoalStartAmount.value ? Math.round(parseFloat(newGoalStartAmount.value) * 100) : undefined, eff,
    newGoalCategory.value.trim() || undefined);
  newGoalName.value = ""; newGoalParticipants.value = []; newGoalTarget.value = ""; newGoalStartAmount.value = ""; newGoalEffectiveFrom.value = ""; newGoalCategory.value = ""; showForm.value = false;
}
async function submitContribution(gid: string) { const a = parseFloat(contributionValue.value); if (isNaN(a)) return; await props.api.submitGoalContribution(gid, Math.round(a * 100)); contributionValue.value = ""; }
async function doEndGoal(id: string) { await props.api.endGoal(id, endingEffectiveFrom.value); endingGoalId.value = null; }
</script>

<template>
  <div class="page-header"><h2>Goals</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="submit" class="add-form">
    <div class="field"><span class="field-label">Name</span><input v-model="newGoalName" placeholder="e.g. Car Fund" class="input" /></div>
    <div class="field">
      <span class="field-label">Participants</span>
      <ParticipantPicker :members="members" v-model="newGoalParticipants" />
    </div>
    <div class="field" v-if="newGoalParticipants.length > 1"><span class="field-label">Split method</span><select v-model="newGoalSplitRule" class="input"><option value="even">Even</option><option value="proportional">Proportional</option></select></div>
    <div class="field"><span class="field-label">Target (optional)</span><input v-model="newGoalTarget" placeholder="0.00" type="number" step="0.01" min="0" class="input" /></div>
    <div class="field"><span class="field-label">Start amount (optional)</span><input v-model="newGoalStartAmount" placeholder="0.00" type="number" step="0.01" min="0" class="input" /></div>
    <div class="field"><span class="field-label">From</span><MonthPicker v-model="newGoalEffectiveFrom" placeholder="From" /></div>
    <input v-model="newGoalCategory" list="goal-cats" placeholder="Category (optional)" class="input input-sm" />
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div class="card" v-if="goalProgress.length > 0">
    <h3 class="card-label">Progress</h3>
    <ul class="ov-list">
      <li v-for="gp in goalProgress" :key="gp.goalId" class="ov-row">
        <svg class="orbit-ring" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#262A38" stroke-width="3" /><circle cx="16" cy="16" r="13" fill="none" stroke="#7DC9E8" stroke-width="3" stroke-dasharray="81.7" :stroke-dashoffset="81.7 * (1 - goalPct(gp) / 100)" stroke-linecap="round" transform="rotate(-90 16 16)" /></svg>
         <span>{{ gp.goalName }}<span v-if="isGoalPending(gp.goalId)" class="pending-label">pending</span></span>
        <span class="muted" style="font-size:11px">{{ (goals.find(g => g.id === gp.goalId)?.participants ?? []).map(memberName).join(', ') }}</span>
        <span>{{ formatCurrency(gp.accumulatedCents) }}<template v-if="gp.targetAmountCents !== undefined"> / {{ formatCurrency(gp.targetAmountCents) }}</template></span>
        <span class="gp-pct">{{ goalPct(gp) }}%</span>
      </li>
    </ul>
  </div>
  <div class="card" v-if="goals.length > 0">
    <h3 class="card-label">Manage</h3>
    <ul class="ov-list">
       <li v-for="g in goals" :key="g.id" class="ov-row">
        <span :class="{ ended: g.endedFrom !== undefined }">{{ g.name }}</span>
        <template v-if="g.endedFrom === undefined">
          <input v-model="contributionValue" placeholder="0.00" type="number" step="0.01" min="0" class="input input-xs" />
          <button @click="submitContribution(g.id)" class="btn-accent">Save</button>
          <template v-if="endingGoalId === g.id">
            <MonthPicker v-model="endingEffectiveFrom" placeholder="Ended in" />
            <button @click="doEndGoal(g.id)" class="btn-ghost danger">Confirm End</button>
            <button @click="endingGoalId = null" class="btn-ghost">Cancel</button>
          </template>
          <button v-else @click="endingGoalId = g.id" class="btn-ghost danger">End</button>
        </template>
        <span v-else class="muted">ended {{ g.endedFrom }}</span>
      </li>
    </ul>
  </div>
  <datalist id="goal-cats">
    <option v-for="c in [...new Set(goals.map(g => g.category).filter(Boolean))]" :key="c" :value="c" />
  </datalist>
</template>

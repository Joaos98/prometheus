<script setup lang="ts">
import type { Goal, GoalContribution } from "@prometheus/engine";
import type { MonthlySummary } from "@prometheus/engine";
import { ref } from "vue";

const props = defineProps<{
  members: { id: string; name: string }[];
  goals: Goal[];
  summary: MonthlySummary;
  currency: string;
  displayMonth: string;
  api: {
    addGoal(name: string, participants: string[], targetAmountCents?: number, startAmountCents?: number): Promise<unknown>;
    endGoal(id: string): Promise<unknown>;
    addGoalContribution(goalId: string, memberId: string, month: string, amountCents: number): Promise<unknown>;
  };
}>();

const showForm = ref(false);
const newName = ref(""); const newParticipants = ref<string[]>([]);
const newTarget = ref(""); const newStart = ref("");
const contributionValues = ref<Record<string, string>>({});

const fmt = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: props.currency }).format(cents / 100);

function activeGoals() { return props.goals.filter(g => g.active); }
function toggleP(mid: string) { const i = newParticipants.value.indexOf(mid); if (i >= 0) newParticipants.value.splice(i, 1); else newParticipants.value.push(mid); }
function goalPct(gp: { accumulatedCents: number; targetAmountCents?: number }) {
  if (!gp.targetAmountCents || gp.targetAmountCents === 0) return 0;
  return Math.min(100, Math.round((gp.accumulatedCents / gp.targetAmountCents) * 100));
}
function pendingGoal(gid: string) { return props.summary.pendingContributions?.some(p => p.goalId === gid); }
function progressFor(gid: string) { return props.summary.goalProgress.find(p => p.goalId === gid); }

async function submit() {
  if (!newName.value.trim() || newParticipants.value.length === 0) return;
  await props.api.addGoal(
    newName.value.trim(), [...newParticipants.value],
    newTarget.value ? Math.round(parseFloat(newTarget.value) * 100) : undefined,
    newStart.value ? Math.round(parseFloat(newStart.value) * 100) : undefined,
  );
  newName.value = ""; newParticipants.value = []; newTarget.value = ""; newStart.value = ""; showForm.value = false;
}

async function saveContribution(gid: string, mid: string) {
  const key = `${gid}:${mid}`;
  const a = parseFloat(contributionValues.value[key] ?? "");
  if (isNaN(a)) return;
  await props.api.addGoalContribution(gid, mid, props.displayMonth, Math.round(a * 100));
  delete contributionValues.value[key];
}
</script>

<template>
  <div class="page-header"><h2>Goals</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add Goal' }}</button></div>

  <form v-if="showForm" @submit.prevent="submit" class="add-form">
    <div class="field"><span class="field-label">Name</span><input v-model="newName" placeholder="e.g. Car Fund" class="input" /></div>
    <fieldset class="check-group"><legend>Participants</legend><label v-for="m in members" :key="m.id" class="check"><input type="checkbox" @change="toggleP(m.id)" /> {{ m.name }}</label></fieldset>
    <div class="field"><span class="field-label">Target (optional)</span><input v-model="newTarget" placeholder="0.00" type="number" step="0.01" min="0" class="input" /></div>
    <div class="field"><span class="field-label">Start amount (optional)</span><input v-model="newStart" placeholder="0.00" type="number" step="0.01" min="0" class="input" /></div>
    <button type="submit" class="btn-accent">Save</button>
  </form>

  <div class="card" v-if="summary.goalProgress.length > 0">
    <h3 class="card-label">Progress</h3>
    <ul class="ov-list">
      <li v-for="gp in summary.goalProgress" :key="gp.goalId" class="ov-row">
        <svg class="orbit-ring" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#262A38" stroke-width="3" /><circle cx="16" cy="16" r="13" fill="none" stroke="#7DC9E8" stroke-width="3" stroke-dasharray="81.7" :stroke-dashoffset="81.7 * (1 - goalPct(gp) / 100)" stroke-linecap="round" transform="rotate(-90 16 16)" /></svg>
        <span>{{ gp.goalName }}<span v-if="pendingGoal(gp.goalId)" class="pending-label">pending</span></span>
        <span class="goal-total">{{ fmt(gp.accumulatedCents) }}<template v-if="gp.targetAmountCents !== undefined"> / {{ fmt(gp.targetAmountCents) }}</template></span>
      </li>
    </ul>
  </div>

  <div class="card" v-if="activeGoals().length > 0">
    <h3 class="card-label">Contributions this Month</h3>
    <ul class="ov-list">
      <li v-for="g in activeGoals()" :key="g.id" class="ov-row exp-row">
        <span>{{ g.name }}</span>
        <div class="exp-det">
          <div v-for="m in members.filter(m => g.participants.includes(m.id))" :key="m.id" class="share-row">
            <span>{{ m.name }}</span>
            <input :value="contributionValues[`${g.id}:${m.id}`] ?? ''" @input="contributionValues[`${g.id}:${m.id}`] = ($event.target as HTMLInputElement).value" placeholder="0.00" type="number" step="0.01" min="0" class="input input-xs" />
            <button @click="saveContribution(g.id, m.id)" class="btn-ghost">Save</button>
          </div>
          <div class="exp-actions">
            <button @click="props.api.endGoal(g.id)" class="btn-ghost danger">End Goal</button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

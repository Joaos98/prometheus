<script setup lang="ts">
import type { GoalProgress, SavingsGoal } from "@prometheus/engine";

defineProps<{
  goalProgress: GoalProgress[];
  goals: SavingsGoal[];
  currency: string;
  pendingContributions: { itemId: string; itemName: string }[];
  formatCurrency: (cents: number, currency: string) => string;
}>();
</script>

<template>
  <div class="card">
    <h3 class="card-label">Goal progress</h3>
    <ul class="ov-list" v-if="goalProgress.length > 0">
      <li v-for="gp in goalProgress" :key="gp.goalId" class="ov-row">
        <svg class="orbit-ring" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#262A38" stroke-width="3" /><circle cx="16" cy="16" r="13" fill="none" stroke="#7DC9E8" stroke-width="3" :stroke-dasharray="81.7" :stroke-dashoffset="81.7 * (1 - (gp.targetAmountCents && gp.targetAmountCents > 0 ? Math.min(100, Math.round((gp.accumulatedCents / gp.targetAmountCents) * 100)) : 0) / 100)" stroke-linecap="round" transform="rotate(-90 16 16)" /></svg>
        <span class="goal-info">
          <span>{{ gp.goalName }}
            <span v-if="pendingContributions.some(p => p.itemId === gp.goalId)" class="pending-label">pending</span>
          </span>
          <span class="goal-participants" v-if="gp.memberShares.length > 0">
            <span v-for="(s, i) in gp.memberShares" :key="s.memberId">{{ s.name }} saved {{ formatCurrency(s.amountCents, currency) }}{{ i < gp.memberShares.length - 1 ? ', ' : '' }}</span>
          </span>
        </span>
        <span class="goal-total">{{ formatCurrency(gp.accumulatedCents, currency) }}<template v-if="gp.targetAmountCents !== undefined"> / {{ formatCurrency(gp.targetAmountCents, currency) }}</template></span>
      </li>
    </ul>
    <p v-else class="ov-empty">No goals yet</p>
  </div>
</template>

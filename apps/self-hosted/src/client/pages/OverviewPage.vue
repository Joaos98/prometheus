<script setup lang="ts">
import type { Expense, GoalProgress, MemberSummary, SavingsGoal } from "@prometheus/engine";
defineProps<{
  summary: { currency: string; members: MemberSummary[]; goalProgress: GoalProgress[] };
  members: { id: string; name: string }[];
  expenses: Expense[];
  goals: SavingsGoal[];
  activeExpenses: () => Expense[];
  expenseHasAmount: (id: string) => boolean;
  expenseAmountCents: (id: string) => number | undefined;
  goalProgressPercent: (gp: GoalProgress) => number;
  memberName: (id: string) => string;
  formatCurrency: (cents: number, currency: string) => string;
  householdLeftover: number;
}>();
</script>

<template>
  <section class="balance-row">
    <div class="balance-card" v-for="m in summary.members" :key="m.memberId">
      <span class="balance-label">{{ m.name }}</span>
      <span class="balance-value" :class="{ negative: m.leftoverCents < 0 }">{{ formatCurrency(m.leftoverCents, summary.currency) }}</span>
    </div>
    <div class="balance-card balance-total">
      <span class="balance-label">Household</span>
      <span class="balance-value" :class="{ negative: householdLeftover < 0 }">{{ formatCurrency(householdLeftover, summary.currency) }}</span>
    </div>
  </section>

  <section class="overview-grid">
    <div class="card">
      <h3 class="card-label">Active expenses</h3>
      <ul class="ov-list">
        <li v-for="e in activeExpenses()" :key="e.id" class="ov-row">
          <span :class="{ pending: !expenseHasAmount(e.id) }">{{ e.name }}</span>
          <span v-if="expenseHasAmount(e.id)">{{ formatCurrency(expenseAmountCents(e.id)!, summary.currency) }}</span>
          <span v-else class="pending-badge">pending</span>
          <span class="muted" style="font-size:11px">{{ e.participants.map(memberName).join(', ') }}</span>
        </li>
        <li v-if="activeExpenses().length === 0" class="ov-empty">No active expenses</li>
      </ul>
    </div>
    <div class="card">
      <h3 class="card-label">Goal progress</h3>
      <ul class="ov-list">
        <li v-for="gp in summary.goalProgress" :key="gp.goalId" class="ov-row">
          <svg class="orbit-ring" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#262A38" stroke-width="3" /><circle cx="16" cy="16" r="13" fill="none" stroke="#7DC9E8" stroke-width="3" stroke-dasharray="81.7" :stroke-dashoffset="81.7 * (1 - goalProgressPercent(gp) / 100)" stroke-linecap="round" transform="rotate(-90 16 16)" /></svg>
          <span>{{ gp.goalName }}</span>
          <span class="muted" style="font-size:11px">{{ (goals.find(g => g.id === gp.goalId)?.participants ?? []).map(memberName).join(', ') }}</span>
          <span class="gp-pct">{{ goalProgressPercent(gp) }}%</span>
        </li>
        <li v-if="summary.goalProgress.length === 0" class="ov-empty">No goals yet</li>
      </ul>
    </div>
  </section>

  <section class="card">
    <h3 class="card-label">Leftover</h3>
    <div class="leftover-row">
      <div class="leftover-col" v-for="m in summary.members" :key="m.memberId">
        <span class="lcol-name">{{ m.name }}</span>
        <div class="lcol-line"><span>Income</span><span>{{ formatCurrency(m.incomeCents - m.restrictedCents, summary.currency) }}</span></div>
        <div class="lcol-line" v-if="m.restrictedCents > 0"><span>Restricted</span><span class="muted">{{ formatCurrency(m.restrictedCents, summary.currency) }}</span></div>
        <div class="lcol-line"><span>− Shares</span><span>{{ formatCurrency(m.totalCents, summary.currency) }}</span></div>
        <div class="lcol-line" v-if="m.contributionCents > 0"><span>− Goals</span><span>{{ formatCurrency(m.contributionCents, summary.currency) }}</span></div>
        <div class="lcol-divider"></div>
        <div class="lcol-line lcol-result"><span>= Leftover</span><span>{{ formatCurrency(m.leftoverCents, summary.currency) }}</span></div>
      </div>
    </div>
  </section>
</template>

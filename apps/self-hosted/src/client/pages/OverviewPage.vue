<script setup lang="ts">
import type { Expense, ExpenseAmount, GoalProgress, IncomeSource, MemberSummary, SavingsGoal } from "@prometheus/engine";
import GoalProgressCard from "../components/GoalProgressCard.vue";

const props = defineProps<{
  summary: { currency: string; members: MemberSummary[]; goalProgress: GoalProgress[]; pendingContributions: { itemId: string; itemName: string }[] };
  members: { id: string; name: string }[];
  expenses: Expense[];
  goals: SavingsGoal[];
  incomeSources: IncomeSource[];
  expenseAmounts: ExpenseAmount[];
  displayMonth: string;
  goalProgressPercent: (gp: GoalProgress) => number;
  memberName: (id: string) => string;
  formatCurrency: (cents: number, currency: string) => string;
}>();

function activeExpenses() { return props.expenses.filter(e => e.effectiveFrom <= props.displayMonth && (e.endedFrom === undefined || e.endedFrom > props.displayMonth)); }
function expenseHasAmount(eid: string) { return props.expenseAmounts.some(a => a.expenseId === eid && a.month === props.displayMonth); }
function expenseAmountCents(eid: string) { return props.expenseAmounts.find(a => a.expenseId === eid && a.month === props.displayMonth)?.amountCents; }
function isGoalPending(gid: string) { return props.summary.pendingContributions.some(p => p.itemId === gid); }
function sourcesForMember(mid: string) { return props.incomeSources.filter(s => s.memberId === mid); }
const latestAmount = (s: IncomeSource) => { const a = [...s.timeline].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)); return a[0]?.amountCents ?? 0; };
const householdIncome = props.summary.members.reduce((s, m) => s + m.incomeCents, 0);
const householdRestricted = props.summary.members.reduce((s, m) => s + m.restrictedCents, 0);
</script>

<template>
  <section class="balance-row">
    <div class="balance-card">
      <span class="balance-label">Total income</span>
      <span class="balance-value">{{ formatCurrency(householdIncome, summary.currency) }}</span>
    </div>
    <div class="balance-card">
      <span class="balance-label">Spendable</span>
      <span class="balance-value">{{ formatCurrency(householdIncome - householdRestricted, summary.currency) }}</span>
    </div>
    <div class="balance-card">
      <span class="balance-label">Restricted</span>
      <span class="balance-value muted">{{ formatCurrency(householdRestricted, summary.currency) }}</span>
    </div>
  </section>

  <section class="balance-row">
    <div class="balance-card" v-for="m in summary.members" :key="m.memberId">
      <span class="balance-label">{{ m.name }}</span>
      <span class="balance-value">{{ formatCurrency(m.incomeCents, summary.currency) }}</span>
      <div class="income-sources" v-if="sourcesForMember(m.memberId).length > 0">
        <div class="income-source-row" v-for="s in sourcesForMember(m.memberId)" :key="s.id">
          <span>{{ s.name }}</span>
          <span>{{ formatCurrency(latestAmount(s), summary.currency) }}</span>
        </div>
      </div>
    </div>
  </section>

  <section class="overview-grid">
    <div class="card">
      <h3 class="card-label">Active expenses</h3>
      <ul class="ov-list">
        <li v-for="e in activeExpenses()" :key="e.id" class="ov-row">
          <span>{{ e.name }}<span v-if="!expenseHasAmount(e.id)" class="pending-label">pending</span></span>
          <span v-if="expenseHasAmount(e.id)">{{ formatCurrency(expenseAmountCents(e.id)!, summary.currency) }}</span>
          <span class="muted" style="font-size:11px">{{ e.splitRule.method }}</span>
          <span class="muted" style="font-size:11px">|</span>
          <span class="muted" style="font-size:11px">{{ e.participants.map(memberName).join(', ') }}</span>
        </li>
        <li v-if="activeExpenses().length === 0" class="ov-empty">No active expenses</li>
      </ul>
    </div>
    <GoalProgressCard :goalProgress="summary.goalProgress" :goals="goals" :currency="summary.currency" :pendingContributions="summary.pendingContributions" :formatCurrency="formatCurrency" />
  </section>

  <h3 class="section-heading">Leftover</h3>
  <div class="leftover-row">
    <div class="card leftover-col" v-for="m in summary.members" :key="m.memberId">
      <div class="lcol-name">{{ m.name }}</div>
        <div class="lcol-lines">
          <div class="lcol-line"><span>Income</span><span>{{ formatCurrency(m.incomeCents - m.restrictedCents, summary.currency) }}</span></div>
          <div class="lcol-line" v-if="m.restrictedCents > 0"><span>Restricted</span><span class="muted">{{ formatCurrency(m.restrictedCents, summary.currency) }}</span></div>
          <div class="lcol-line"><span>− Shares</span><span>{{ formatCurrency(m.totalCents, summary.currency) }}</span></div>
          <div class="lcol-line" v-if="m.contributionCents > 0"><span>− Goals</span><span>{{ formatCurrency(m.contributionCents, summary.currency) }}</span></div>
        </div>
        <div class="lcol-result-line"><span>= Leftover</span><span>{{ formatCurrency(m.leftoverCents, summary.currency) }}</span></div>
    </div>
  </div>
</template>

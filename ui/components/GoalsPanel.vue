<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  accumulatedProgress,
  contributionTo,
  formatAmount,
  isReviewed,
  type Household,
  type MemberId,
  type Minor,
  type Month,
  type RowId,
  type SavingsGoal,
} from '../../domain/index.js'
import { editableAmount, readAmount } from '../amount.js'
import { useHousehold } from '../household.js'
import { membersOf } from '../members.js'
import GoalForm from './GoalForm.vue'
import MonthPanel from './MonthPanel.vue'

const props = defineProps<{ household: Household; month: Month }>()

const { addGoal, editGoal, removeGoal, confirmGoal, contribute } = useHousehold()

const adding = ref(false)
const editing = ref<RowId | undefined>(undefined)
const expanded = ref<RowId | undefined>(undefined)
const failure = ref<string | undefined>(undefined)

const members = computed(() => membersOf(props.household, props.month))

/**
 * Every goal of the Month with its progress as of this Month, and — per ADR-0010 — every
 * member of the Month against it, not only its Participants, so that "who is not saving
 * for this" is answerable without opening the form.
 */
const rows = computed(() =>
  props.month.goals.map((goal) => ({
    goal,
    progress: accumulatedProgress(props.household, props.month.key, goal.id),
    members: members.value.map((member) => ({
      ...member,
      participant: goal.participants.includes(member.id),
      contribution: contributionTo(goal, member.id),
      entered: goal.contributions[member.id] !== undefined,
    })),
  })),
)

const money = (amount: Minor): string => formatAmount(amount, props.household.currency)

/** How much of the bar is filled. A goal with no target has nothing to fill against. */
function reachedFraction(accumulated: Minor, target: Minor | null): number {
  if (target === null || target <= 0) return 0
  return Math.min(accumulated / target, 1)
}

function toggle(goal: SavingsGoal): void {
  expanded.value = expanded.value === goal.id ? undefined : goal.id
  editing.value = undefined
}

function edit(goal: SavingsGoal): void {
  editing.value = goal.id
  expanded.value = goal.id
}

async function attempt(change: Promise<void>): Promise<void> {
  failure.value = undefined
  try {
    await change
    adding.value = false
    editing.value = undefined
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  }
}

/** A Contribution as typed: an empty field takes it back to nothing entered at all. */
function enterContribution(goal: SavingsGoal, member: MemberId, typed: string): void {
  failure.value = undefined
  try {
    const amount = readAmount(typed, props.household.currency)
    void attempt(contribute(props.month.key, goal.id, member, amount))
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  }
}

const editableContribution = (amount: Minor, entered: boolean): string =>
  entered ? editableAmount(amount, props.household.currency) : ''
</script>

<template>
  <MonthPanel title="Savings Goals">
    <template #header>
      <button v-if="!adding" class="add" type="button" @click="adding = true">+ Add goal</button>
    </template>

    <p v-if="failure" class="failure note">{{ failure }}</p>

    <GoalForm
      v-if="adding"
      :currency="household.currency"
      :members="members"
      submit-label="Add goal"
      @cancel="adding = false"
      @save="(draft) => attempt(addGoal(month.key, draft))"
    />

    <p v-if="rows.length === 0 && !adding" class="muted note">
      No Savings Goals in this Month yet.
    </p>

    <article v-for="{ goal, progress, members: against } in rows" :key="goal.id" class="goal">
      <div class="head">
        <button
          class="summary"
          type="button"
          :aria-expanded="expanded === goal.id"
          :aria-label="`${expanded === goal.id ? 'Collapse' : 'Expand'} ${goal.name}`"
          @click="toggle(goal)"
        >
          <div class="line">
            <span class="name">{{ goal.name }}</span>
            <span v-if="!isReviewed(goal)" class="tag unreviewed">Unreviewed</span>
            <span class="figure progress">
              {{ money(progress.accumulated) }}
              <span v-if="progress.target !== null" class="muted">
                of {{ money(progress.target) }}
              </span>
              <span v-else class="muted">saved</span>
            </span>
          </div>

          <div
            v-if="progress.target !== null"
            class="bar"
            role="presentation"
            :title="`${money(progress.remaining!)} left to reach the target`"
          >
            <span
              class="filled"
              :style="{ width: `${reachedFraction(progress.accumulated, progress.target) * 100}%` }"
            />
          </div>

          <div class="line detail">
            <span class="muted">
              {{ money(progress.thisMonth) }} contributed this Month
            </span>
            <span v-if="progress.reached" class="reached">Target reached</span>
          </div>
        </button>

        <button
          v-if="!isReviewed(goal)"
          class="confirm"
          type="button"
          :aria-label="`Confirm ${goal.name}`"
          @click="attempt(confirmGoal(month.key, goal.id))"
        >
          Confirm
        </button>
        <button
          class="remove"
          type="button"
          :aria-label="`Remove ${goal.name}`"
          @click="attempt(removeGoal(month.key, goal.id))"
        >
          ×
        </button>
      </div>

      <div v-if="expanded === goal.id" class="expansion">
        <GoalForm
          v-if="editing === goal.id"
          :currency="household.currency"
          :members="members"
          :name="goal.name"
          :target="goal.target"
          :start-amount="goal.startAmount"
          :participants="goal.participants"
          @cancel="editing = undefined"
          @save="(edits) => attempt(editGoal(month.key, goal.id, edits))"
        />

        <ul v-else class="contributions">
          <li v-for="member in against" :key="member.id" :class="{ outside: !member.participant }">
            <span class="who">{{ member.name }}</span>
            <input
              v-if="member.participant"
              :value="editableContribution(member.contribution, member.entered)"
              :aria-label="`${member.name}'s Contribution to ${goal.name}`"
              :placeholder="household.currency.code"
              inputmode="decimal"
              type="text"
              @change="enterContribution(goal, member.id, ($event.target as HTMLInputElement).value)"
            />
            <span v-else class="muted">Not a Participant</span>
          </li>
        </ul>

        <dl v-if="editing !== goal.id" class="facts">
          <dt class="muted">Start amount</dt>
          <dd class="figure">{{ money(progress.startAmount) }}</dd>
          <dt class="muted">Accumulated Progress</dt>
          <dd class="figure">{{ money(progress.accumulated) }}</dd>
          <dt class="muted">Contributed this Month</dt>
          <dd class="figure">{{ money(progress.thisMonth) }}</dd>
        </dl>

        <button v-if="editing !== goal.id" class="add" type="button" @click="edit(goal)">
          Edit goal
        </button>
      </div>
    </article>
  </MonthPanel>
</template>

<style scoped>
.goal {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal + .goal {
  padding-top: 12px;
  border-top: 0.5px solid var(--hairline);
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.summary {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  text-align: left;
  background: none;
  border: 0.5px solid transparent;
  border-radius: var(--radius-control);
}

.summary:hover {
  border-color: var(--hairline);
}

.line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.name {
  font-weight: 500;
}

.progress {
  margin-left: auto;
  white-space: nowrap;
}

.detail {
  font-size: 12px;
}

.reached {
  margin-left: auto;
  color: var(--ice);
}

.bar {
  height: 4px;
  background: var(--page);
  border-radius: 999px;
  overflow: hidden;
}

.filled {
  display: block;
  height: 100%;
  background: var(--ice);
}

.tag {
  padding: 1px 6px;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border: 0.5px solid var(--hairline);
  border-radius: 999px;
}

.unreviewed {
  color: var(--fire);
  border-color: var(--fire);
}

.expansion {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 8px 4px;
}

.contributions {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.contributions li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.contributions input {
  width: 110px;
  padding: 5px 8px;
  text-align: right;
}

.outside .who {
  color: var(--text-muted);
}

.facts {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  font-size: 13px;
}

.facts dt,
.facts dd {
  margin: 0;
}

.facts dd {
  text-align: right;
}

.confirm {
  align-self: flex-start;
  margin-top: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--fire);
  background: none;
  border: 0.5px solid var(--hairline);
}

.confirm:hover {
  border-color: var(--fire);
}

.remove {
  padding: 8px;
  color: var(--text-muted);
  background: none;
  border: 0.5px solid transparent;
}

.remove:hover {
  color: var(--text);
  border-color: var(--hairline);
}

.add {
  align-self: flex-start;
  padding: 0;
  color: var(--fire);
  background: none;
  border: none;
  font-size: 13px;
}

.failure {
  margin: 0;
  color: var(--fire-bright);
}

.note {
  font-size: 13px;
}
</style>

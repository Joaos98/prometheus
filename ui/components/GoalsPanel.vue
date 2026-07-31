<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  accumulatedProgress,
  contributionTo,
  formatAmount,
  isOneOff,
  isReviewed,
  type GoalEdits,
  type Household,
  type MemberId,
  type Minor,
  type Month,
  type RowId,
  type SavingsGoal,
} from '../../domain/index.js'
import { editableAmount, readAmount } from '../amount.js'
import { laterOpenedMonths, type Carrying } from '../carry-forward.js'
import { messageOf, useChanges } from '../changes.js'
import { useHousehold } from '../household.js'
import { membersOf } from '../members.js'
import CarryForward from './CarryForward.vue'
import GoalForm from './GoalForm.vue'
import MonthPanel from './MonthPanel.vue'

const props = defineProps<{ household: Household; month: Month }>()

const { addGoal, editGoal, removeGoal, confirmGoal, markGoalAsOneOff, contribute } = useHousehold()

const { failure, report } = useChanges()

const adding = ref(false)
const editing = ref<RowId | undefined>(undefined)
const expanded = ref<RowId | undefined>(undefined)

/** An edit that has landed, waiting on whether it should reach the later Months too. */
const carrying = ref<Carrying | undefined>(undefined)

const members = computed(() => membersOf(props.household, props.month))

const later = computed(() => laterOpenedMonths(props.household, props.month.key))

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

/**
 * A change made from a form, which closes once it is accepted and stays open if it is
 * not. A change made from a row uses `report` instead and leaves the panel's forms
 * exactly as it found them: entering a Contribution is the routine monthly action, and
 * it must not throw away a goal somebody is halfway through typing.
 */
async function attempt(change: Promise<void>): Promise<void> {
  if (!(await report(change))) return
  adding.value = false
  editing.value = undefined
}

/**
 * An edit that lands, and then the offer to carry it into the Months already open after
 * this one. Only an edit raises it: a goal recorded here for the first time is on no later
 * Month's thread, so there is nothing there for it to correct. Contributions are never
 * among a goal's edits, so nothing a member put in anywhere is ever carried.
 */
async function saveEdit(goal: SavingsGoal, edits: GoalEdits): Promise<void> {
  if (!(await report(editGoal(props.month.key, goal.id, edits)))) return
  editing.value = undefined
  if (later.value.length > 0) {
    carrying.value = { kind: 'goals', id: goal.id, name: goal.name, edits }
  }
}

/** A Contribution as typed: an empty field takes it back to nothing entered at all. */
function enterContribution(goal: SavingsGoal, member: MemberId, typed: string): void {
  try {
    const amount = readAmount(typed, props.household.currency)
    void report(contribute(props.month.key, goal.id, member, amount))
  } catch (cause) {
    failure.value = messageOf(cause)
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

    <CarryForward
      v-if="carrying"
      :month="month.key"
      :later="later"
      :carrying="carrying"
      @done="carrying = undefined"
    />

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
            <span v-if="isOneOff(goal)" class="tag one-off">One-Off</span>
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
          @click="report(confirmGoal(month.key, goal.id))"
        >
          Confirm
        </button>
        <button
          v-if="!isOneOff(goal)"
          class="mark-one-off"
          type="button"
          :aria-label="`Mark ${goal.name} One-Off`"
          @click="report(markGoalAsOneOff(month.key, goal.id))"
        >
          One-Off
        </button>
        <button
          class="remove"
          type="button"
          :aria-label="`Remove ${goal.name}`"
          @click="report(removeGoal(month.key, goal.id))"
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
          @save="(edits) => saveEdit(goal, edits)"
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

.one-off {
  color: var(--text-secondary);
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

.mark-one-off {
  align-self: flex-start;
  margin-top: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: 0.5px solid transparent;
}

.mark-one-off:hover {
  color: var(--text);
  border-color: var(--hairline);
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

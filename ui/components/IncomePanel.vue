<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  formatAmount,
  isOneOff,
  isPending,
  isReviewed,
  spendableIncome,
  type Household,
  type IncomeEdits,
  type IncomeSnapshot,
  type MemberId,
  type Minor,
  type Month,
  type RowId,
} from '../../domain/index.js'
import { laterOpenedMonths, type Carrying } from '../carry-forward.js'
import { useChanges } from '../changes.js'
import { useHousehold } from '../household.js'
import { nameOf } from '../members.js'
import CarryForward from './CarryForward.vue'
import IncomeForm from './IncomeForm.vue'
import MonthPanel from './MonthPanel.vue'

const props = defineProps<{ household: Household; month: Month }>()

const { addIncome, editIncome, removeIncome, confirmIncome, markIncomeAsOneOff } = useHousehold()

const { failure, report } = useChanges()

const adding = ref<MemberId | undefined>(undefined)
const editing = ref<RowId | undefined>(undefined)

/** An edit that has landed, waiting on whether it should reach the later Months too. */
const carrying = ref<Carrying | undefined>(undefined)

const later = computed(() => laterOpenedMonths(props.household, props.month.key))

const members = computed(() =>
  props.month.members.map((id) => ({
    id,
    name: nameOf(props.household, id),
    sources: props.month.income.filter((row) => row.member === id),
    spendable: spendableIncome(props.month, id),
  })),
)

const money = (amount: Minor): string => formatAmount(amount, props.household.currency)

/**
 * A change made from a form, which closes once it is accepted and stays open if it is
 * not. A change made from a row uses `report` instead, so that confirming or removing
 * one source never throws away another the member is halfway through typing.
 */
async function attempt(change: Promise<void>): Promise<void> {
  if (!(await report(change))) return
  adding.value = undefined
  editing.value = undefined
}

/**
 * An edit that lands, and then the offer to carry it into the Months already open after
 * this one. Only an edit raises it: a source recorded here for the first time is on no
 * later Month's thread, so there is nothing there for it to correct.
 */
async function saveEdit(source: IncomeSnapshot, edits: IncomeEdits): Promise<void> {
  if (!(await report(editIncome(props.month.key, source.id, edits)))) return
  editing.value = undefined
  if (later.value.length > 0) {
    carrying.value = { kind: 'income', id: source.id, name: source.name, edits }
  }
}
</script>

<template>
  <MonthPanel title="Income">
    <p v-if="failure" class="failure note">{{ failure }}</p>

    <CarryForward
      v-if="carrying"
      :month="month.key"
      :later="later"
      :carrying="carrying"
      @done="carrying = undefined"
    />

    <section v-for="member in members" :key="member.id" class="member">
      <header>
        <h3>{{ member.name }}</h3>
        <span class="figure spendable">{{ money(member.spendable) }}</span>
      </header>
      <p class="section-label spendable-label">Spendable Income</p>

      <ul class="sources">
        <li v-for="source in member.sources" :key="source.id">
          <IncomeForm
            v-if="editing === source.id"
            :currency="household.currency"
            :name="source.name"
            :amount="source.amount"
            :restricted-use="source.restrictedUse"
            @cancel="editing = undefined"
            @save="(edits) => saveEdit(source, edits)"
          />
          <template v-else>
            <button
              class="source"
              type="button"
              :aria-label="`Edit ${source.name}`"
              @click="editing = source.id"
            >
              <span class="name">
                {{ source.name }}
                <span v-if="source.restrictedUse" class="tag">Restricted-Use</span>
                <span v-if="isOneOff(source)" class="tag one-off">One-Off</span>
                <span v-if="!isReviewed(source)" class="tag unreviewed">Unreviewed</span>
              </span>
              <span v-if="isPending(source)" class="pending">Pending</span>
              <span v-else class="figure" :class="{ restricted: source.restrictedUse }">
                {{ money(source.amount!) }}
              </span>
            </button>
            <button
              v-if="!isReviewed(source)"
              class="confirm"
              type="button"
              :aria-label="`Confirm ${source.name}`"
              @click="report(confirmIncome(month.key, source.id))"
            >
              Confirm
            </button>
            <button
              v-if="!isOneOff(source)"
              class="mark-one-off"
              type="button"
              :aria-label="`Mark ${source.name} One-Off`"
              @click="report(markIncomeAsOneOff(month.key, source.id))"
            >
              One-Off
            </button>
            <button
              class="remove"
              type="button"
              :aria-label="`Remove ${source.name}`"
              @click="report(removeIncome(month.key, source.id))"
            >
              ×
            </button>
          </template>
        </li>
      </ul>

      <IncomeForm
        v-if="adding === member.id"
        :currency="household.currency"
        submit-label="Add source"
        @cancel="adding = undefined"
        @save="(draft) => attempt(addIncome(month.key, { ...draft, member: member.id }))"
      />
      <button v-else class="add" type="button" @click="adding = member.id">+ Add source</button>
    </section>
  </MonthPanel>
</template>

<style scoped>
.member + .member {
  padding-top: 14px;
  border-top: 0.5px solid var(--hairline);
}

.member {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.member header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

h3 {
  font-size: 14px;
}

.spendable {
  color: var(--fire);
}

.spendable-label {
  margin: -4px 0 4px;
  text-align: right;
}

.sources {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sources li {
  display: flex;
  align-items: center;
  gap: 4px;
}

.source {
  flex: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px;
  text-align: left;
  background: none;
  border: 0.5px solid transparent;
}

.source:hover {
  border-color: var(--hairline);
}

.name {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.tag {
  padding: 1px 6px;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border: 0.5px solid var(--hairline);
  border-radius: 999px;
}

.restricted {
  color: var(--text-muted);
}

.unreviewed {
  color: var(--fire);
  border-color: var(--fire);
}

.one-off {
  color: var(--text-secondary);
}

.pending {
  color: var(--fire-bright);
  font-size: 12px;
}

.confirm {
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
  padding: 4px 8px;
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
  padding: 4px 0;
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

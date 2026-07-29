<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  formatAmount,
  isPending,
  spendableIncome,
  type Household,
  type MemberId,
  type Minor,
  type Month,
  type RowId,
} from '../../domain/index.js'
import { useHousehold } from '../household.js'
import IncomeForm from './IncomeForm.vue'
import MonthPanel from './MonthPanel.vue'

const props = defineProps<{ household: Household; month: Month }>()

const { addIncome, editIncome, removeIncome } = useHousehold()

const adding = ref<MemberId | undefined>(undefined)
const editing = ref<RowId | undefined>(undefined)
const failure = ref<string | undefined>(undefined)

const members = computed(() =>
  props.month.members.map((id) => ({
    id,
    name: props.household.roster.find((member) => member.id === id)?.name ?? 'Unknown member',
    sources: props.month.income.filter((row) => row.member === id),
    spendable: spendableIncome(props.month, id),
  })),
)

const money = (amount: Minor): string => formatAmount(amount, props.household.currency)

async function attempt(change: Promise<void>): Promise<void> {
  failure.value = undefined
  try {
    await change
    adding.value = undefined
    editing.value = undefined
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  }
}
</script>

<template>
  <MonthPanel title="Income">
    <p v-if="failure" class="failure note">{{ failure }}</p>

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
            @save="
              (edits) => attempt(editIncome(month.key, source.id, edits))
            "
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
              </span>
              <span v-if="isPending(source)" class="pending">Pending</span>
              <span v-else class="figure" :class="{ restricted: source.restrictedUse }">
                {{ money(source.amount!) }}
              </span>
            </button>
            <button
              class="remove"
              type="button"
              :aria-label="`Remove ${source.name}`"
              @click="attempt(removeIncome(month.key, source.id))"
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

.pending {
  color: var(--fire-bright);
  font-size: 12px;
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

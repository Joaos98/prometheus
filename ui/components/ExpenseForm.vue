<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  requireConsistentRule,
  type Currency,
  type MemberId,
  type Minor,
  type SplitRule,
} from '../../domain/index.js'
import { editableAmount, readAmount, readPercentage } from '../amount.js'
import { messageOf } from '../changes.js'
import { isIndividual, RULE_CHOICES, ruleFor, type RuleValues } from '../split-rules.js'

const props = withDefaults(
  defineProps<{
    currency: Currency
    members: { id: MemberId; name: string }[]
    name?: string
    category?: string
    amount?: Minor | null
    participants?: MemberId[]
    splitRule?: SplitRule
    submitLabel?: string
  }>(),
  {
    name: '',
    category: '',
    amount: null,
    participants: undefined,
    splitRule: () => ({ kind: 'even' }),
    submitLabel: 'Save',
  },
)

const emit = defineEmits<{
  save: [
    {
      name: string
      category: string
      amount: Minor | null
      participants: MemberId[]
      splitRule: SplitRule
    },
  ]
  cancel: []
}>()

const name = ref(props.name)
const category = ref(props.category)
const amount = ref(editableAmount(props.amount, props.currency))
const participants = ref<MemberId[]>(props.participants ?? props.members.map((one) => one.id))
const kind = ref<SplitRule['kind']>(props.splitRule.kind)
const percentages = ref<RuleValues>(startingPercentages())
const fixedAmounts = ref<RuleValues>(startingFixedAmounts())
const failure = ref<string | undefined>(undefined)

function startingPercentages(): RuleValues {
  const rule = props.splitRule
  return Object.fromEntries(
    props.members.map((member) => [
      member.id,
      rule.kind === 'percentage' ? String(rule.byMember[member.id] ?? '') : '',
    ]),
  )
}

function startingFixedAmounts(): RuleValues {
  const rule = props.splitRule
  return Object.fromEntries(
    props.members.map((member) => [
      member.id,
      rule.kind === 'fixed' && rule.byMember[member.id] !== undefined
        ? editableAmount(rule.byMember[member.id]!, props.currency)
        : '',
    ]),
  )
}

/** The amount as it stands in the field, or nothing while it is not yet an amount. */
const enteredAmount = computed<Minor | null>(() => {
  try {
    return readAmount(amount.value, props.currency)
  } catch {
    return null
  }
})

/**
 * The Split Rule as the fields stand. It refuses what it cannot read rather than passing
 * a number that is not one along: the engine would have to word its refusal without ever
 * having seen what was typed, and `NaN is not a percentage` is nobody's sentence.
 */
function chosenRule(): SplitRule {
  switch (kind.value) {
    case 'even':
    case 'proportional':
      return { kind: kind.value }
    case 'percentage':
      return {
        kind: 'percentage',
        byMember: Object.fromEntries(
          participants.value.map((member) => [
            member,
            readPercentage(percentages.value[member] ?? ''),
          ]),
        ),
      }
    case 'fixed':
      return {
        kind: 'fixed',
        byMember: Object.fromEntries(
          participants.value.map((member) => [
            member,
            readAmountOrZero(fixedAmounts.value[member] ?? ''),
          ]),
        ),
      }
  }
}

function readAmountOrZero(entered: string): Minor {
  try {
    return readAmount(entered, props.currency) ?? 0
  } catch {
    return 0
  }
}

/**
 * An Expense with exactly one Participant. Their Share is the whole of it whatever the
 * rule says, so the choice is not offered and Even is what gets saved — the question has
 * one possible answer, and asking it is how a member ends up in front of a complaint
 * about a split with nothing left to divide.
 */
const individual = computed(() => isIndividual(participants.value))

/** The rule this form will actually submit, which is what everything here judges. */
const submittedRule = computed(() => ruleFor(participants.value, chosenRule()))

/** The same judgement the engine will make on save, said while the split is still wrong. */
const standing = computed(() => {
  const rule = submittedRule.value
  if (rule.kind === 'even' || rule.kind === 'proportional') return undefined
  try {
    requireConsistentRule(rule, enteredAmount.value, participants.value, props.currency)
    return { adds: true, said: 'Adds up.' }
  } catch (cause) {
    return { adds: false, said: messageOf(cause) }
  }
})

const participantsIn = computed(() =>
  props.members.filter((member) => participants.value.includes(member.id)),
)

function save(): void {
  failure.value = undefined
  try {
    emit('save', {
      name: name.value,
      category: category.value,
      amount: readAmount(amount.value, props.currency),
      participants: participants.value,
      splitRule: submittedRule.value,
    })
  } catch (cause) {
    failure.value = messageOf(cause)
  }
}
</script>

<template>
  <form class="inset expense-form" @submit.prevent="save">
    <div class="line">
      <input v-model="name" aria-label="Expense" placeholder="What is it" type="text" />
      <input v-model="category" aria-label="Category" placeholder="Category" type="text" />
      <input
        v-model="amount"
        aria-label="Amount"
        :placeholder="`Amount in ${currency.code}, or nothing`"
        inputmode="decimal"
        type="text"
      />
    </div>

    <fieldset>
      <legend class="section-label">Participants</legend>
      <label v-for="member in members" :key="member.id" class="choice">
        <input
          v-model="participants"
          :value="member.id"
          :aria-label="member.name"
          type="checkbox"
        />
        <span>{{ member.name }}</span>
      </label>
    </fieldset>

    <!-- Not asked of an individual expense: one Participant takes the whole of it under
         every rule, so the choice would have one possible answer. -->
    <fieldset v-if="!individual">
      <legend class="section-label">Split Rule</legend>
      <label v-for="choice in RULE_CHOICES" :key="choice.kind" class="choice" :title="choice.note">
        <input v-model="kind" :value="choice.kind" name="split-rule" type="radio" />
        <span>{{ choice.name }}</span>
      </label>
    </fieldset>

    <div v-if="!individual && (kind === 'percentage' || kind === 'fixed')" class="custom">
      <label v-for="member in participantsIn" :key="member.id" class="value">
        <span class="secondary">{{ member.name }}</span>
        <input
          v-if="kind === 'percentage'"
          v-model="percentages[member.id]"
          :aria-label="`${member.name}'s percentage`"
          inputmode="decimal"
          placeholder="%"
          type="text"
        />
        <input
          v-else
          v-model="fixedAmounts[member.id]"
          :aria-label="`${member.name}'s amount`"
          inputmode="decimal"
          :placeholder="currency.code"
          type="text"
        />
      </label>
    </div>

    <p v-if="standing" class="standing note" :class="{ short: !standing.adds }">
      {{ standing.said }}
    </p>
    <p v-else-if="!individual && kind === 'proportional'" class="muted note">
      Weighted by Spendable Income. Nobody earning this Month means it divides evenly instead.
    </p>

    <p v-if="failure" class="failure note">{{ failure }}</p>

    <div class="actions">
      <button
        class="button-primary"
        type="submit"
        :disabled="name.trim() === '' || standing?.adds === false"
      >
        {{ submitLabel }}
      </button>
      <button class="button-quiet" type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.line {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 8px;
}

fieldset {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: none;
}

legend {
  padding: 0;
  margin-bottom: 6px;
}

.choice {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.custom {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.value input {
  width: 96px;
  padding: 5px 8px;
}

.standing {
  color: var(--text-muted);
}

.standing.short {
  color: var(--fire-bright);
}
</style>

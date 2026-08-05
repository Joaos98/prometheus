<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  formatAmount,
  isComposite,
  requireConsistentRule,
  totalOfLines,
  type Category,
  type CategoryId,
  type Currency,
  type LineItem,
  type MemberId,
  type Minor,
  type RowId,
  type SplitRule,
} from '../../domain/index.js'
import { editableAmount, readAmount, readPercentage } from '../amount.js'
import { messageOf, useChanges } from '../changes.js'
import { lineCount, type LineFields, type LineOperations } from '../lines.js'
import { isIndividual, RULE_CHOICES, ruleFor, type RuleValues } from '../split-rules.js'

const props = withDefaults(
  defineProps<{
    currency: Currency
    members: { id: MemberId; name: string }[]
    name?: string
    category?: CategoryId | null
    amount?: Minor | null
    /** The Household's vocabulary, in the order it is offered — everything the picker has. */
    categories?: Category[]
    /**
     * Adding a category from inside the form, which is a Household write and so belongs to
     * the panel. Absent where the form is not to offer it, in which case the picker offers
     * the vocabulary as it stands and nothing else.
     */
    addCategory?: (name: string) => Promise<CategoryId | undefined>
    participants?: MemberId[]
    splitRule?: SplitRule
    submitLabel?: string
    /** Only an add form asks whether the Expense is One-Off; an existing row uses its own flag. */
    adding?: boolean
    /** The row's Line Items as the engine holds them; empty means a simple Expense. */
    lines?: LineItem[]
    /** Absent while adding, when there is no row yet to itemise or add a line to. */
    lineOperations?: LineOperations
  }>(),
  {
    name: '',
    category: null,
    amount: null,
    categories: () => [],
    addCategory: undefined,
    participants: undefined,
    splitRule: () => ({ kind: 'even' }),
    submitLabel: 'Save',
    adding: false,
    lines: () => [],
    lineOperations: undefined,
  },
)

const emit = defineEmits<{
  save: [
    {
      name: string
      category: CategoryId | null
      amount: Minor | null
      participants: MemberId[]
      splitRule: SplitRule
      oneOff?: boolean
    },
  ]
  cancel: []
}>()

const name = ref(props.name)

/**
 * The category as an id into the Household's vocabulary, or none. A picker and never a
 * text box: the whole reason the vocabulary is stored is that a typo must not become a
 * second category, and a field that mints one from whatever was typed is exactly that typo
 * with a nicer name on it.
 */
const category = ref<CategoryId | null>(props.category)

/**
 * The picker's own value, which is a string because that is what a `<select>` holds. None
 * is `''` here and `null` everywhere else: an option bound to `null` leaves the control
 * showing a blank rather than "No category" on a row that has none, which reads as a
 * picker that failed to load rather than as the answer it is.
 *
 * A category the vocabulary no longer holds reads as none too, and for the same reason —
 * there is no option to show it against, so the control would go blank. It is the reading a
 * row's chip already gives that row (`categoryName`), and saving from here writes the none
 * that is on screen rather than quietly putting the dangling id back.
 */
const chosenCategory = computed({
  get: () =>
    props.categories.some((choice) => choice.id === category.value) ? category.value! : '',
  set: (chosen: string) => {
    category.value = chosen === '' ? null : chosen
  },
})
const amount = ref(editableAmount(props.amount, props.currency))
const participants = ref<MemberId[]>(props.participants ?? props.members.map((one) => one.id))
const kind = ref<SplitRule['kind']>(props.splitRule.kind)
const percentages = ref<RuleValues>(startingPercentages())
const fixedAmounts = ref<RuleValues>(startingFixedAmounts())
const oneOff = ref(false)
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

/** An Expense whose amount is what its Line Items come to rather than a figure typed here. */
const composite = computed(() => isComposite({ lines: props.lines }))

/** What the lines come to, which is the amount a composite has. */
const derivedTotal = computed<Minor | null>(() => totalOfLines(props.lines))

/**
 * The amount the rest of the form reasons about: the running total while there are lines,
 * and the field otherwise. This is the one line that makes the Split Rule's live judgement
 * below cover a composite — it is asked of the total either way, and never learns which of
 * the two produced it.
 */
const enteredAmount = computed<Minor | null>(() => {
  if (composite.value) return derivedTotal.value
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

/**
 * The rule this form will actually submit — the choice as it stands, or Even where one
 * Participant makes the choice meaningless.
 *
 * A function and not a computed, deliberately. `chosenRule` refuses what it cannot read,
 * so a percentage typed as `abc` throws, and a computed that throws cannot be contained by
 * whoever reads it: Vue refreshes a computed dependency during its own dirty-checking,
 * outside any `try` here, and the throw comes back out as a dead render. Called inside the
 * two `try` blocks that want the refusal, it is caught where it can be worded.
 */
const submittedRule = (): SplitRule => ruleFor(participants.value, chosenRule())

/** The same judgement the engine will make on save, said while the split is still wrong. */
const standing = computed(() => {
  if (individual.value || kind.value === 'even' || kind.value === 'proportional') return undefined
  try {
    requireConsistentRule(submittedRule(), enteredAmount.value, participants.value, props.currency)
    return { adds: true, said: 'Adds up.' }
  } catch (cause) {
    return { adds: false, said: messageOf(cause) }
  }
})

const participantsIn = computed(() =>
  props.members.filter((member) => participants.value.includes(member.id)),
)

/**
 * Each line as it stands in its own two fields, keyed by the line's identity.
 *
 * Re-seeded from the row whenever the row changes, which is to say whenever a line
 * operation is accepted. A refusal changes no row, so nothing is re-seeded and what the
 * member typed is still in front of them to correct — which is the whole of "does not
 * discard what the member typed".
 */
const lineFields = ref<Record<RowId, LineFields>>({})

/**
 * What the row last said, so that a line whose stored values have not moved keeps whatever
 * is in its fields. Re-seeding wholesale would be simpler and would throw away a second
 * line a member had started typing every time the first one landed.
 */
let seeded: Record<RowId, LineFields> = {}

watch(
  () => props.lines,
  (lines) => {
    const fields: Record<RowId, LineFields> = {}
    const canonical: Record<RowId, LineFields> = {}
    for (const line of lines) {
      const says = { name: line.name, amount: editableAmount(line.amount, props.currency) }
      const held = lineFields.value[line.id]
      const unmoved = seeded[line.id]
      canonical[line.id] = says
      fields[line.id] =
        held && unmoved && unmoved.name === says.name && unmoved.amount === says.amount
          ? held
          : { ...says }
    }
    lineFields.value = fields
    seeded = canonical
  },
  { immediate: true, deep: true },
)

/**
 * The typed amount comes back when the last line goes, holding what the lines came to.
 * The engine hands it back on the row; this is the field catching up with it, and it is
 * watched rather than computed so that nothing overwrites what a member is typing while
 * the Expense is simple.
 */
watch(
  () => props.lines.length,
  (now, before) => {
    if (before > 0 && now === 0) amount.value = editableAmount(props.amount, props.currency)
  },
)

const newLine = ref({ name: '', amount: '' })

/**
 * There has to be a figure for the first line to carry, which is the engine's own rule: a
 * Pending Expense has no amount to itemise, and what is wanted there is a line with a name
 * of its own, which is the field below. Read from the field rather than the row, because
 * the field is what the action promises to turn into the first line.
 */
const canItemise = computed(() => !composite.value && enteredAmount.value !== null)

/**
 * A line operation's refusals, said beside the split's own rather than above the list —
 * the two judge the same thing from either side, and a member reading one should not have
 * to look somewhere else for the other.
 */
const { failure: lineFailure, report } = useChanges()

/**
 * A refusal speaks of the split as it stood when the change was tried, so moving any part
 * of that answer retires it — otherwise the member settles who absorbs the difference and
 * is still being told they have not.
 */
watch([kind, percentages, fixedAmounts, participants], () => {
  lineFailure.value = undefined
})

/**
 * The Split Rule as the fields stand, for the operations that move the total. Unreadable
 * fields answer with nothing rather than throwing: the engine then judges the rule the row
 * already carries, which is the rule that is actually in force until a save changes it.
 */
function ruleNow(): SplitRule | undefined {
  try {
    return submittedRule()
  } catch {
    return undefined
  }
}

/**
 * One line operation, with whatever the fields could not be read as said in the form's own
 * words. `readAmount` refuses what is not an amount, and that refusal has to reach the
 * member: swallowed, a mistyped figure would land as a line with no figure at all, which
 * is a Pending line nobody asked for and no message to say why.
 */
function carryOut(operation: (operations: LineOperations) => Promise<void>): Promise<boolean> {
  const operations = props.lineOperations
  if (!operations) return Promise.resolve(false)
  try {
    return report(operation(operations))
  } catch (cause) {
    lineFailure.value = messageOf(cause)
    return Promise.resolve(false)
  }
}

function itemise(): void {
  void carryOut((operations) => operations.itemise(enteredAmount.value!))
}

async function addLine(): Promise<void> {
  const landed = await carryOut((operations) =>
    operations.add(
      { name: newLine.value.name, amount: readAmount(newLine.value.amount, props.currency) },
      ruleNow(),
    ),
  )
  if (!landed) return
  newLine.value = { name: '', amount: '' }
}

/**
 * Commits a line's two fields, on leaving either of them or on Enter.
 *
 * On blur rather than on `change`, because a refused edit has to stay retryable: `change`
 * fires once for a value and not again, so a member who settles who absorbs the difference
 * and comes back to the line would find nothing would re-submit it. Blur asks every time,
 * and the guard below is what keeps that from meaning a write every time — a line whose
 * fields still say what the row says has nothing to commit, which is also the case after a
 * successful edit and is why the loop terminates.
 */
function editLine(line: LineItem): void {
  const fields = lineFields.value[line.id]
  const says = seeded[line.id]
  if (!fields || !says) return
  if (fields.name === says.name && fields.amount === says.amount) return

  void carryOut((operations) =>
    operations.edit(
      line.id,
      { name: fields.name, amount: readAmount(fields.amount, props.currency) },
      ruleNow(),
    ),
  )
}

function removeLine(line: LineItem): void {
  void carryOut((operations) => operations.remove(line.id, ruleNow()))
}

const money = (amount: Minor): string => formatAmount(amount, props.currency)

/**
 * Adding a category from inside the form, which is an act of its own and looks like one:
 * a member asks for it, types a name into a field that is nothing but that, and sees the
 * name land on the picker. What this is not is a picker that quietly mints whatever was
 * typed into it — that is the second "groceries" the vocabulary exists to prevent.
 */
const namingCategory = ref(false)
const newCategoryName = ref('')
const minting = ref(false)

function nameCategory(): void {
  failure.value = undefined
  newCategoryName.value = ''
  namingCategory.value = true
}

/**
 * Mints the category and chooses it, so the member sees the name they typed on the row
 * they were filling in. A refusal — a name already taken, an empty one — is said in the
 * form's own failure line and leaves the field as it was to be corrected.
 */
async function mintCategory(): Promise<void> {
  const add = props.addCategory
  if (!add || minting.value) return
  failure.value = undefined
  minting.value = true
  try {
    const minted = await add(newCategoryName.value)
    if (!minted) return
    category.value = minted
    namingCategory.value = false
    newCategoryName.value = ''
  } catch (cause) {
    failure.value = messageOf(cause)
  } finally {
    minting.value = false
  }
}

function save(): void {
  failure.value = undefined
  lineFailure.value = undefined
  try {
    emit('save', {
      name: name.value,
      // What the picker is showing, so that a category which has gone from the vocabulary
      // is saved as the none it reads as rather than as the id nothing can name.
      category: chosenCategory.value === '' ? null : chosenCategory.value,
      amount: readAmount(amount.value, props.currency),
      participants: participants.value,
      splitRule: submittedRule(),
      ...(props.adding && { oneOff: oneOff.value }),
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
      <!-- Chosen from what the Household already uses, or left as none. There is nothing
           to type here: a name typed into a picker is how a vocabulary acquires its second
           spelling of the same word. -->
      <select v-model="chosenCategory" aria-label="Category">
        <option value="">No category</option>
        <option v-for="choice in categories" :key="choice.id" :value="choice.id">
          {{ choice.name }}
        </option>
      </select>
      <!-- What a composite costs is what its lines come to, so there is no figure here to
           type: the total is shown where the field was, and the lines below are where it
           is changed. -->
      <p v-if="composite" class="derived" aria-label="Amount">
        <span v-if="derivedTotal === null" class="pending">Pending</span>
        <span v-else class="figure">{{ money(derivedTotal) }}</span>
        <span class="muted from-lines">from {{ lineCount(lines) }}</span>
      </p>
      <input
        v-else
        v-model="amount"
        aria-label="Amount"
        :placeholder="`Amount in ${currency.code}, or nothing`"
        inputmode="decimal"
        type="text"
      />
    </div>

    <!-- The way to a category the Household has not got yet, offered as its own action
         rather than as something the picker does on its own. -->
    <div v-if="addCategory" class="new-category">
      <button v-if="!namingCategory" class="link-action" type="button" @click="nameCategory()">
        + New category
      </button>
      <template v-else>
        <input
          v-model="newCategoryName"
          aria-label="New category name"
          placeholder="Name the category"
          type="text"
          @keydown.enter.prevent="mintCategory()"
        />
        <button
          class="button-quiet"
          type="button"
          :disabled="minting || newCategoryName.trim() === ''"
          @click="mintCategory()"
        >
          {{ minting ? 'Adding…' : 'Add' }}
        </button>
        <button class="button-quiet" type="button" @click="namingCategory = false">Cancel</button>
      </template>
    </div>

    <!-- Only an existing row has lines to edit: there is nothing to itemise until the
         Expense has been recorded, so an add form is given no operations and shows none. -->
    <fieldset v-if="lineOperations" class="lines">
      <legend class="section-label">Line Items</legend>

      <button
        v-if="!composite"
        class="link-action"
        type="button"
        :disabled="!canItemise"
        @click="itemise()"
      >
        Itemise — make this amount the first line
      </button>

      <template v-else>
        <div v-for="line in lines" :key="line.id" class="line-row">
          <input
            v-model="lineFields[line.id]!.name"
            :aria-label="`${line.name} name`"
            type="text"
            @blur="editLine(line)"
            @keyup.enter="editLine(line)"
          />
          <input
            v-model="lineFields[line.id]!.amount"
            :aria-label="`${line.name} amount`"
            :placeholder="`${currency.code}, or nothing`"
            inputmode="decimal"
            type="text"
            @blur="editLine(line)"
            @keyup.enter="editLine(line)"
          />
          <button
            class="row-action remove"
            type="button"
            :aria-label="`Remove the line ${line.name}`"
            @click="removeLine(line)"
          >
            ×
          </button>
        </div>

        <p v-if="derivedTotal === null" class="pending note">
          Pending — a line has no figure, so this Expense has no amount
        </p>
      </template>

      <!-- One way in, per state. A simple Expense with a figure itemises that figure; one
           with nothing entered has no figure to itemise and starts with a named line
           instead; a composite grows by the same field. -->
      <div v-if="composite || !canItemise" class="line-row">
        <input
          v-model="newLine.name"
          aria-label="New line"
          placeholder="What is the line"
          type="text"
          @keydown.enter.prevent="addLine()"
        />
        <input
          v-model="newLine.amount"
          aria-label="New line amount"
          :placeholder="`${currency.code}, or nothing`"
          inputmode="decimal"
          type="text"
          @keydown.enter.prevent="addLine()"
        />
        <button
          class="add-line"
          type="button"
          aria-label="Add the line"
          :disabled="newLine.name.trim() === ''"
          @click="addLine()"
        >
          +
        </button>
      </div>
    </fieldset>

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

    <label v-if="adding" class="one-off-option">
      <input v-model="oneOff" type="checkbox" />
      <span>One-Off — this Month alone; the next Month opened will not inherit it</span>
    </label>

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

    <!-- A refused line stands ahead of an "Adds up.", which is still speaking of the Expense
         as it stands and would otherwise agree cheerfully beside a refusal saying otherwise:
         the change was turned away, so the row it describes has not moved. A split that does
         *not* add up is never hidden — it is what disables Save, and a button disabled for a
         reason the member cannot read is worse than two messages. -->
    <p v-if="lineFailure" class="standing note short">{{ lineFailure }}</p>
    <p v-if="standing && !(lineFailure && standing.adds)" class="standing note" :class="{ short: !standing.adds }">
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

/* Under the line it belongs to, and narrow: naming a category is a small aside inside a
   larger form, not a second form competing with it. */
.new-category {
  display: flex;
  align-items: center;
  gap: 8px;
}

.new-category input {
  max-width: 220px;
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

.choice,
.one-off-option {
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

/* The derived total stands where the amount field would be, reading as a figure rather
   than as a field somebody forgot to fill in. */
.derived {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  padding: 5px 0;
}

.from-lines {
  font-size: 12px;
}

.pending {
  color: var(--fire-bright);
}

/* One grid across every line — the legend, the Itemise link and each row of fields
   alike — rather than one grid per row: columns sized independently per row is what let
   the name and amount fields of one line drift out of step with the ones above it. Each
   `.line-row` renders (`display: contents`) rather than boxes of its own, so its three
   fields land as direct cells of this same grid and share its column widths exactly. */
.lines {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  align-items: center;
  gap: 6px 8px;
}

.lines > legend,
.lines > .link-action,
.lines > .pending.note {
  grid-column: 1 / -1;
}

.line-row {
  display: contents;
}

.lines .row-action {
  padding: 4px 9px;
}

/* Filled like the form's own Save, so committing a line reads as the same weight of
   action. Sized to the column the remove buttons already share rather than to its own
   glyph, so it neither widens that column past them nor floats out of line. */
.add-line {
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1;
  color: var(--page);
  background: var(--fire);
  border: none;
}

.add-line:hover:not(:disabled) {
  background: var(--fire-bright);
}

.add-line:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>

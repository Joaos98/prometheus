<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { paymentMethodUsage, type Household, type PaymentMethodId } from '../../domain/index.js'
import { costOfDeleting, paymentMethodChoices } from '../payment-methods.js'
import { useChanges } from '../changes.js'
import { useHousehold } from '../household.js'

const props = defineProps<{ household: Household }>()

const { addPaymentMethod, renamePaymentMethod, deletePaymentMethod, clearAndDeletePaymentMethod } =
  useHousehold()
const { failure, report, reporting } = useChanges()

const paymentMethods = computed(() => paymentMethodChoices(props.household))

const name = ref('')

/** The field is emptied only once the Household holds a payment method under that name. */
async function add(): Promise<void> {
  if (await reporting(addPaymentMethod(name.value))) name.value = ''
}

/** The payment method being renamed, and the name it is being given. */
const renaming = ref<{ id: PaymentMethodId; name: string } | undefined>(undefined)

/**
 * The field the rename is typed into, focused as it appears. The button that raised it is
 * the same element that has just been replaced by the field, so leaving focus where it was
 * would leave it on nothing at all — and a member working by keyboard would be dropped back
 * to the top of the panel to find a field that opened for them.
 */
const renameField = ref<HTMLInputElement | undefined>(undefined)

/**
 * A function ref rather than a name, because the field is inside the `v-for` over the
 * payment methods: a named ref used there collects into an array, and only one payment
 * method is ever being renamed. This holds the one field that exists, or nothing once it
 * has gone.
 */
function keepRenameField(element: unknown): void {
  renameField.value = element instanceof HTMLInputElement ? element : undefined
}

function startRenaming(id: PaymentMethodId, current: string): void {
  failure.value = undefined
  asking.value = undefined
  renaming.value = { id, name: current }
  void nextTick(() => renameField.value?.select())
}

/**
 * A rename lands against every Month at once, past Months included, because a row holds
 * the id and never the name. There is nothing to confirm: it renames a label, and the way
 * back is to rename it again.
 */
async function rename(): Promise<void> {
  const being = renaming.value
  if (!being) return
  if (!(await report(renamePaymentMethod(being.id, being.name)))) return
  renaming.value = undefined
}

/** The payment method a member has asked to delete, and what giving it up costs right now. */
const asking = ref<PaymentMethodId | undefined>(undefined)

function ask(id: PaymentMethodId): void {
  if (busy.value) return
  failure.value = undefined
  renaming.value = undefined
  asking.value = id
}

/**
 * What the delete would cost, read afresh from the Household as it stands rather than from
 * whatever it cost when the question was asked — the other member may have set it on a
 * row since, and the figure this sentence names is the one the member is agreeing to.
 */
const cost = computed(() =>
  asking.value ? costOfDeleting(paymentMethodUsage(props.household, asking.value)) : undefined,
)

/**
 * The delete being carried out, while it is being carried out — which payment method, and
 * whether it is the long half. A clear is N row writes across the whole record (ADR-0012),
 * so on a long record it is not instant, and every other control in the panel is held shut
 * while it runs: a second delete starting on top of this would be writing rows against a
 * Household this one has not finished moving.
 *
 * A delete that takes nothing with it is held the same way, for a smaller reason. Two clicks
 * in the same breath would send the second against a payment method that has already gone,
 * and what the member would read is the engine saying it is not a payment method this
 * Household has — a refusal of a delete that in fact succeeded.
 */
const deleting = ref<{ id: PaymentMethodId; clearing: boolean } | undefined>(undefined)

/** Whether anything is being deleted at all, which is what holds the panel's controls shut. */
const busy = computed(() => deleting.value !== undefined)

/** Whether the long half is running against this payment method, which is what the button says. */
const isClearing = (id: PaymentMethodId): boolean =>
  deleting.value?.clearing === true && deleting.value.id === id

/** An unused payment method, which goes on a single confirmation and takes nothing with it. */
async function remove(id: PaymentMethodId): Promise<void> {
  if (busy.value) return
  deleting.value = { id, clearing: false }
  try {
    if (!(await report(deletePaymentMethod(id)))) return
    asking.value = undefined
  } finally {
    deleting.value = undefined
  }
}

/**
 * A payment method in use: every row that holds it is cleared, and only then does the
 * payment method go. Both halves have been said out loud before this runs — the row count,
 * the Months, that it cannot be undone and that an export is the way back.
 *
 * What a clear that stopped partway leaves behind has to be said, because the payment
 * method coming back to the list unexplained would read as a delete that simply did not
 * happen. The sentence is appended to the refusal rather than kept beside it, so that it
 * lives and dies with the message it belongs to — held on its own it would still be
 * sitting there, under a later rename or add that succeeded.
 *
 * It says what is true whether one row was written or none: the halves run in that order
 * (ADR-0012), so a stop leaves the payment method listed and the deletion unmade, and
 * whatever rows it did get through stay cleared. Which of those two it was, this cannot
 * know — the writes are the store's, and claiming rows were cleared when none were is the
 * same kind of untruth as claiming the delete succeeded.
 */
async function clearAndRemove(id: PaymentMethodId): Promise<void> {
  if (busy.value) return
  deleting.value = { id, clearing: true }
  try {
    if (await report(clearAndDeletePaymentMethod(id))) {
      asking.value = undefined
      return
    }
    failure.value =
      `${failure.value} — the clear did not finish, so nothing was deleted and the payment ` +
      'method is still here. Any rows it had already cleared stay cleared; running it again ' +
      'finishes the job.'
  } finally {
    deleting.value = undefined
  }
}
</script>

<template>
  <div class="payment-methods">
    <p class="muted note">
      Payment methods are the Household's own vocabulary, shared by every Month, separate
      from categories. Renaming one relabels every Month at once, this one and the settled
      ones alike, because a row holds the payment method and not the word.
    </p>

    <p v-if="paymentMethods.length === 0" class="muted note">
      No payment methods yet. An Expense may be left unset for as long as you like.
    </p>

    <ul v-else class="list">
      <li v-for="method in paymentMethods" :key="method.id">
        <template v-if="renaming?.id === method.id">
          <form class="renaming" @submit.prevent="rename">
            <input
              :ref="keepRenameField"
              v-model="renaming!.name"
              type="text"
              :aria-label="`Rename ${method.name}`"
            />
            <button class="button-primary" type="submit">Rename</button>
            <button class="button-quiet" type="button" @click="renaming = undefined">Cancel</button>
          </form>
        </template>

        <template v-else>
          <span class="name">{{ method.name }}</span>
          <button
            class="button-quiet"
            type="button"
            :disabled="busy"
            @click="startRenaming(method.id, method.name)"
          >
            Rename
          </button>
          <button class="button-quiet" type="button" :disabled="busy" @click="ask(method.id)">
            Delete
          </button>
        </template>

        <!-- The confirmation, under the payment method it speaks of and naming what it costs
             in the same terms Discarding a Month names its own. -->
        <div v-if="asking === method.id" class="question">
          <template v-if="cost">
            <p class="note lead">Deleting "{{ method.name }}" — it is {{ cost }}.</p>
            <p class="muted note">
              Those rows can be cleared of it and the payment method then deleted. This cannot
              be undone, and reaches into Months that are settled history: exporting the
              Household file first is the only way back.
            </p>
            <div class="actions">
              <button
                class="destructive"
                type="button"
                :disabled="busy"
                @click="clearAndRemove(method.id)"
              >
                {{ isClearing(method.id) ? 'Clearing the rows…' : 'Clear the rows and delete' }}
              </button>
              <button class="button-quiet" type="button" :disabled="busy" @click="asking = undefined">
                Keep it
              </button>
            </div>
            <p v-if="isClearing(method.id)" class="muted note">
              Every row that holds it is being written, one at a time. Leaving this Month or
              closing the window before it finishes stops it partway.
            </p>
          </template>

          <template v-else>
            <p class="note lead">
              Deleting "{{ method.name }}". No row holds it, so nothing else changes.
            </p>
            <div class="actions">
              <button class="destructive" type="button" @click="remove(method.id)">Delete</button>
              <button class="button-quiet" type="button" @click="asking = undefined">
                Keep it
              </button>
            </div>
          </template>
        </div>
      </li>
    </ul>

    <form class="add-form" @submit.prevent="add">
      <input
        v-model="name"
        type="text"
        placeholder="Add a payment method"
        aria-label="New payment method"
      />
      <button class="button-primary" type="submit" :disabled="busy">Add</button>
    </form>

    <p v-if="failure" class="failure note">{{ failure }}</p>
  </div>
</template>

<style scoped>
.payment-methods {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.name {
  flex: 1;
  min-width: 0;
}

.renaming {
  display: flex;
  flex: 1;
  gap: 8px;
}

.renaming input {
  flex: 1;
}

/* The confirmation takes the whole width under its payment method rather than sitting
   beside the buttons that raised it: it is prose to be read, not another control. */
.question {
  flex-basis: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0 4px;
}

.add-form {
  display: flex;
  gap: 8px;
}

.add-form input {
  flex: 1;
}
</style>

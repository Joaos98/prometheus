<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { categoryUsage, type CategoryId, type Household } from '../../domain/index.js'
import { categoryChoices, costOfDeleting } from '../categories.js'
import { useChanges } from '../changes.js'
import { useHousehold } from '../household.js'

const props = defineProps<{ household: Household }>()

const { addCategory, renameCategory, deleteCategory, clearAndDeleteCategory } = useHousehold()
const { failure, report, reporting } = useChanges()

const categories = computed(() => categoryChoices(props.household))

const name = ref('')

/** The field is emptied only once the Household holds a category under that name. */
async function add(): Promise<void> {
  if (await reporting(addCategory(name.value))) name.value = ''
}

/** The category being renamed, and the name it is being given. */
const renaming = ref<{ id: CategoryId; name: string } | undefined>(undefined)

/**
 * The field the rename is typed into, focused as it appears. The button that raised it is
 * the same element that has just been replaced by the field, so leaving focus where it was
 * would leave it on nothing at all — and a member working by keyboard would be dropped back
 * to the top of the panel to find a field that opened for them.
 */
const renameField = ref<HTMLInputElement | undefined>(undefined)

/**
 * A function ref rather than a name, because the field is inside the `v-for` over the
 * categories: a named ref used there collects into an array, and only one category is ever
 * being renamed. This holds the one field that exists, or nothing once it has gone.
 */
function keepRenameField(element: unknown): void {
  renameField.value = element instanceof HTMLInputElement ? element : undefined
}

function startRenaming(id: CategoryId, current: string): void {
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
  if (!(await report(renameCategory(being.id, being.name)))) return
  renaming.value = undefined
}

/** The category a member has asked to delete, and what giving it up costs right now. */
const asking = ref<CategoryId | undefined>(undefined)

function ask(id: CategoryId): void {
  if (deleting.value) return
  failure.value = undefined
  renaming.value = undefined
  asking.value = id
}

/**
 * What the delete would cost, read afresh from the Household as it stands rather than from
 * whatever it cost when the question was asked — the other member may have categorised a
 * row since, and the figure this sentence names is the one the member is agreeing to.
 */
const cost = computed(() =>
  asking.value ? costOfDeleting(categoryUsage(props.household, asking.value)) : undefined,
)

/**
 * The delete being carried out, while it is being carried out — which category, and whether
 * it is the long half. A clear is N row writes across the whole record (ADR-0012), so on a
 * long record it is not instant, and every other control in the panel is held shut while it
 * runs: a second delete starting on top of this would be writing rows against a Household
 * this one has not finished moving.
 *
 * A delete that takes nothing with it is held the same way, for a smaller reason. Two clicks
 * in the same breath would send the second against a category that has already gone, and
 * what the member would read is the engine saying it is not a category this Household has —
 * a refusal of a delete that in fact succeeded.
 */
const deleting = ref<{ id: CategoryId; clearing: boolean } | undefined>(undefined)

/** Whether the long half is running against this category, which is what the button says. */
const isClearing = (id: CategoryId): boolean =>
  deleting.value?.clearing === true && deleting.value.id === id

/**
 * What a clear that stopped partway left behind. The category is still here and some of
 * its rows are already cleared, which is a retry rather than a wreck — but it is not a
 * success either, and saying nothing while the category sits back in the list unexplained
 * is the one reading that would be wrong.
 */
const unfinished = ref<string | undefined>(undefined)

/** An unused category, which goes on a single confirmation and takes nothing with it. */
async function remove(id: CategoryId): Promise<void> {
  if (deleting.value) return
  deleting.value = { id, clearing: false }
  try {
    if (!(await report(deleteCategory(id)))) return
    asking.value = undefined
  } finally {
    deleting.value = undefined
  }
}

/**
 * A category in use: every row that holds it is cleared, and only then does the category
 * go. Both halves have been said out loud before this runs — the row count, the Months,
 * that it cannot be undone and that an export is the way back.
 */
async function clearAndRemove(id: CategoryId): Promise<void> {
  if (deleting.value) return
  unfinished.value = undefined
  deleting.value = { id, clearing: true }
  try {
    if (await report(clearAndDeleteCategory(id))) {
      asking.value = undefined
      return
    }
    unfinished.value =
      'The clear did not finish, so the category is still here and some of its rows may already ' +
      'have been cleared. Nothing was deleted. Running it again picks up where it stopped.'
  } finally {
    deleting.value = undefined
  }
}
</script>

<template>
  <div class="categories">
    <p class="muted note">
      Categories are the Household's own vocabulary, shared by every Month. Renaming one
      relabels every Month at once, this one and the settled ones alike, because a row holds
      the category and not the word.
    </p>

    <p v-if="categories.length === 0" class="muted note">
      No categories yet. An Expense may be left uncategorised for as long as you like.
    </p>

    <ul v-else class="list">
      <li v-for="category in categories" :key="category.id">
        <template v-if="renaming?.id === category.id">
          <form class="renaming" @submit.prevent="rename">
            <input
              :ref="keepRenameField"
              v-model="renaming!.name"
              type="text"
              :aria-label="`Rename ${category.name}`"
            />
            <button class="button-primary" type="submit">Rename</button>
            <button class="button-quiet" type="button" @click="renaming = undefined">Cancel</button>
          </form>
        </template>

        <template v-else>
          <span class="name">{{ category.name }}</span>
          <button
            class="button-quiet"
            type="button"
            :disabled="deleting !== undefined"
            @click="startRenaming(category.id, category.name)"
          >
            Rename
          </button>
          <button
            class="button-quiet"
            type="button"
            :disabled="deleting !== undefined"
            @click="ask(category.id)"
          >
            Delete
          </button>
        </template>

        <!-- The confirmation, under the category it speaks of and naming what it costs in
             the same terms Discarding a Month names its own. -->
        <div v-if="asking === category.id" class="question">
          <template v-if="cost">
            <p class="note lead">Deleting "{{ category.name }}" — it is {{ cost }}.</p>
            <p class="muted note">
              Those rows can be cleared of it and the category then deleted. This cannot be
              undone, and reaches into Months that are settled history: exporting the Household
              file first is the only way back.
            </p>
            <div class="actions">
              <button
                class="destructive"
                type="button"
                :disabled="deleting !== undefined"
                @click="clearAndRemove(category.id)"
              >
                {{ isClearing(category.id) ? 'Clearing the rows…' : 'Clear the rows and delete' }}
              </button>
              <button
                class="button-quiet"
                type="button"
                :disabled="deleting !== undefined"
                @click="asking = undefined"
              >
                Keep it
              </button>
            </div>
            <p v-if="isClearing(category.id)" class="muted note">
              Every row that holds it is being written, one at a time. Leaving this Month or
              closing the window before it finishes stops it partway.
            </p>
          </template>

          <template v-else>
            <p class="note lead">
              Deleting "{{ category.name }}". No row holds it, so nothing else changes.
            </p>
            <div class="actions">
              <button class="destructive" type="button" @click="remove(category.id)">Delete</button>
              <button class="button-quiet" type="button" @click="asking = undefined">
                Keep it
              </button>
            </div>
          </template>
        </div>
      </li>
    </ul>

    <form class="add-form" @submit.prevent="add">
      <input v-model="name" type="text" placeholder="Add a category" aria-label="New category" />
      <button class="button-primary" type="submit" :disabled="deleting !== undefined">Add</button>
    </form>

    <p v-if="unfinished" class="failure note">{{ unfinished }}</p>
    <p v-if="failure" class="failure note">{{ failure }}</p>
  </div>
</template>

<style scoped>
.categories {
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

/* The confirmation takes the whole width under its category rather than sitting beside
   the buttons that raised it: it is prose to be read, not another control. */
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

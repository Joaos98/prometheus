<script setup lang="ts">
import { computed } from 'vue'
import {
  driftOf,
  hasDrift,
  monthName,
  type DriftField,
  type Household,
  type MonthKey,
  type RowDrift,
} from '../../domain/index.js'
import { useChanges } from '../changes.js'
import { labelOf, namesOf, valueOf } from '../drift.js'
import { useHousehold } from '../household.js'

const props = defineProps<{ household: Household; viewing: MonthKey; now: MonthKey }>()

const { refreshDrifted } = useHousehold()
const { failure, report } = useChanges()

const drift = computed(() => driftOf(props.household, props.viewing, props.now))

const showing = computed(() => hasDrift(drift.value))

/** What each difference says, both readings side by side and neither of them favoured. */
const differences = computed(() =>
  drift.value.rows.map((row) => ({
    row,
    fields: row.state === 'changed' ? row.fields.map((field) => reading(row, field)) : [],
  })),
)

function reading(row: RowDrift, field: DriftField) {
  return {
    field,
    label: labelOf(field),
    held: row.held ? valueOf(props.household, row.held, field) : '',
    inherited: row.inherited ? valueOf(props.household, row.inherited, field) : '',
  }
}

const said = (row: RowDrift): string =>
  row.state === 'missing'
    ? 'is not here, and a fresh open would bring it'
    : 'is here, and a fresh open would not bring it'

const took = (row: RowDrift): string => (row.state === 'missing' ? 'Bring it in' : 'Take it out')
</script>

<template>
  <section v-if="showing" class="card drift" aria-label="Drift">
    <header>
      <h2 class="section-label">Drift</h2>
      <p class="secondary note lead">
        {{ monthName(viewing) }} was opened before
        {{ drift.from ? monthName(drift.from) : 'the Month it came from' }} last changed, so the two
        no longer say the same thing. Every row below is one nobody has answered for here —
        anything edited or confirmed in {{ monthName(viewing) }} is this Month's own answer, and is
        left alone.
      </p>
    </header>

    <ul class="differences">
      <li v-for="{ row, fields } in differences" :key="`${row.kind}-${row.id}`">
        <div class="row">
          <span class="name">{{ row.name }}</span>
          <span v-if="row.state !== 'changed'" class="muted state">{{ said(row) }}</span>
          <button
            class="row-action take"
            type="button"
            :aria-label="`Refresh ${row.name} from the Previous Month`"
            @click="report(refreshDrifted(viewing, now, row.kind, row.id))"
          >
            {{ row.state === 'changed' ? 'Take the other reading' : took(row) }}
          </button>
        </div>

        <dl v-if="fields.length" class="fields">
          <template v-for="reading in fields" :key="reading.field">
            <dt class="muted">{{ reading.label }}</dt>
            <dd>
              <span class="here">{{ reading.held }}</span>
              <span class="muted arrow">·</span>
              <span class="there">{{ reading.inherited }}</span>
            </dd>
          </template>
        </dl>
      </li>

      <li v-if="drift.members">
        <div class="row">
          <span class="name">Who this Month is for</span>
          <span class="muted state">comes with a fresh open, not one row at a time</span>
        </div>
        <dl class="fields">
          <dt class="muted">Members</dt>
          <dd>
            <span class="here">{{ namesOf(household, drift.members.held) }}</span>
            <span class="muted arrow">·</span>
            <span class="there">{{ namesOf(household, drift.members.inherited) }}</span>
          </dd>
        </dl>
      </li>
    </ul>

    <p class="muted note">
      Left is what {{ monthName(viewing) }} holds; right is what opening it now would give it.
    </p>

    <p v-if="failure" class="failure note">{{ failure }}</p>
  </section>
</template>

<style scoped>
/*
  Deliberately not styled as a warning: ADR-0001 reserves that for Pending, which is a
  genuine error state. What is reported is a row nobody has read yet (ADR-0011), not one
  known to be wrong, so it is a plain hairline card that says both readings without
  favouring either.
*/
.drift {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lead {
  max-width: 72ch;
}

.differences {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.differences li {
  padding-top: 10px;
  border-top: 0.5px solid var(--hairline);
}

.row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.name {
  font-weight: 500;
}

.state {
  font-size: 12px;
}

/* Neutral, not accented: taking the other reading is not the right answer, only one
   of the two the diff is holding up. */
.take {
  margin-left: auto;
  border-color: var(--hairline);
}

.fields {
  margin: 6px 0 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  font-size: 13px;
}

.fields dt,
.fields dd {
  margin: 0;
}

.arrow {
  margin: 0 8px;
}

</style>

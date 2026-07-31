<script setup lang="ts">
import { computed, ref } from 'vue'
import { monthKey, monthName } from '../../domain/index.js'
import { useChanges } from '../changes.js'
import { CURRENCIES } from '../currencies.js'
import { useHousehold } from '../household.js'
import { MONTH_NAMES } from '../months.js'
import HouseholdFile from '../components/HouseholdFile.vue'

const { setUp } = useHousehold()
const { failure, report } = useChanges()

const currencyCode = ref('')
const memberNames = ref<string[]>(['', ''])
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const working = ref(false)

/**
 * Not every Household starts here. A self-hoster arrives with a backup, and somebody who
 * has been trying the demo arrives with what they built in it — neither should have to
 * invent a currency and a Roster first, only to replace them a moment later.
 */
const importing = ref(false)

const MONTHS = MONTH_NAMES.map((name, index) => ({ value: index + 1, name }))
const years = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i)

const named = computed(() => memberNames.value.map((name) => name.trim()).filter(Boolean))
const startingMonth = computed(() => monthKey(year.value, month.value))
const ready = computed(() => currencyCode.value !== '' && named.value.length > 0)

function addMember(): void {
  memberNames.value.push('')
}

function removeMember(index: number): void {
  memberNames.value.splice(index, 1)
}

async function begin(): Promise<void> {
  const currency = CURRENCIES.find((candidate) => candidate.code === currencyCode.value)
  if (!currency) return
  working.value = true
  await report(setUp({ currency, memberNames: named.value, startingMonth: startingMonth.value }))
  working.value = false
}
</script>

<template>
  <main class="setup">
    <header>
      <h1>Prometheus</h1>
      <p class="secondary">
        Three things and the Household exists: what its amounts are in, who shares them, and the
        Month to start from.
      </p>
    </header>

    <section class="card">
      <h2 class="section-label">Currency</h2>
      <p class="muted hint">
        Every amount in the Household is in this currency. It can be relabelled later, but never
        converted.
      </p>
      <select v-model="currencyCode" aria-label="Currency">
        <option value="" disabled>Choose a currency</option>
        <option v-for="currency in CURRENCIES" :key="currency.code" :value="currency.code">
          {{ currency.code }} — {{ currency.symbol.trim() }}
        </option>
      </select>
    </section>

    <section class="card">
      <h2 class="section-label">Roster</h2>
      <p class="muted hint">Everyone who shares money here. Nobody is ever deleted afterwards.</p>
      <div v-for="(_, index) in memberNames" :key="index" class="member">
        <input
          v-model="memberNames[index]"
          :aria-label="`Member ${index + 1}`"
          placeholder="Name"
          type="text"
        />
        <button
          class="button-quiet"
          type="button"
          :disabled="memberNames.length === 1"
          @click="removeMember(index)"
        >
          Remove
        </button>
      </div>
      <button class="button-quiet add" type="button" @click="addMember">+ Add member</button>
    </section>

    <section class="card">
      <h2 class="section-label">Starting Month</h2>
      <p class="muted hint">
        The first Month opens holding the Roster and no rows — nothing precedes it.
      </p>
      <div class="month">
        <select v-model="month" aria-label="Month">
          <option v-for="option in MONTHS" :key="option.value" :value="option.value">
            {{ option.name }}
          </option>
        </select>
        <select v-model="year" aria-label="Year">
          <option v-for="option in years" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
    </section>

    <p v-if="failure" class="failure">{{ failure }}</p>

    <button class="button-primary" type="button" :disabled="!ready || working" @click="begin">
      Open {{ monthName(startingMonth) }}
    </button>

    <section class="card">
      <h2 class="section-label">Already have a Household?</h2>
      <p class="muted hint">
        A Household exported from another deployment, or from the demo, arrives whole — there is
        nothing to set up first.
      </p>
      <button v-if="!importing" class="button-quiet add" type="button" @click="importing = true">
        Import a Household file
      </button>
      <HouseholdFile v-else />
    </section>
  </main>
</template>

<style scoped>
.setup {
  width: min(520px, 100%);
  margin: 0 auto;
  padding: 64px 24px 96px;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

header p {
  margin: 8px 0 0;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hint {
  margin: 0;
  font-size: 13px;
}

.member {
  display: flex;
  gap: 8px;
}

.add {
  align-self: flex-start;
}

.month {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.failure {
  margin: 0;
  color: var(--fire-bright);
}

.button-primary {
  align-self: flex-start;
}
</style>

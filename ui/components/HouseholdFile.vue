<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  importHousehold,
  monthName,
  whatImportReplaces,
  type Household,
} from '../../domain/index.js'
import { messageOf, useChanges } from '../changes.js'
import { useHousehold } from '../household.js'

const props = defineProps<{ household: Household }>()

const { exportFile, importFile } = useHousehold()
const { failure, report } = useChanges()

/** The file a member has chosen, read through and found readable, waiting to be asked about. */
const chosen = ref<{ name: string; text: string } | undefined>(undefined)
const imported = ref(false)

/**
 * What is about to be lost, said as a member counts it and said of the Household as it
 * stands right now — never of the one that was on screen when the file was chosen.
 */
const replacing = computed(() => {
  const replacement = whatImportReplaces(props.household)
  if (replacement.months === 0) return 'Nothing has been opened here yet.'

  const months =
    replacement.months === 1
      ? monthName(replacement.earliest!)
      : `${replacement.months} Months, ${monthName(replacement.earliest!)} to ${monthName(replacement.latest!)},`
  const entries = replacement.entries === 1 ? '1 entry' : `${replacement.entries} entries`
  const members = replacement.members === 1 ? '1 person' : `${replacement.members} people`
  return `${months} holding ${entries}, and ${members} on the Roster, will be replaced.`
})

function download(): void {
  const file = new Blob([exportFile()], { type: 'application/json' })
  const address = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = address
  link.download = 'prometheus-household.json'
  link.click()
  URL.revokeObjectURL(address)
}

/**
 * A chosen file is read through before it is offered as something to import, so that a
 * file Prometheus cannot read is refused here — where nothing has been replaced yet —
 * rather than in the middle of replacing the Household.
 */
async function choose(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  failure.value = undefined
  imported.value = false
  chosen.value = undefined
  if (!file) return

  const text = await file.text()
  try {
    importHousehold(text)
    chosen.value = { name: file.name, text }
  } catch (cause) {
    failure.value = messageOf(cause)
  }
}

async function confirm(): Promise<void> {
  const file = chosen.value
  if (!file) return
  if (!(await report(importFile(file.text)))) return
  chosen.value = undefined
  imported.value = true
}
</script>

<template>
  <div class="file">
    <p class="muted note">
      The file holds the whole Household — the currency, the Roster and every opened Month with
      all its rows. What this device alone decides, like which member the dashboard puts first,
      is not in it.
    </p>

    <div class="actions">
      <button class="button-primary" type="button" @click="download">Export a file</button>
      <label class="button-quiet choose">
        Choose a file to import
        <input type="file" accept="application/json,.json" @change="choose" />
      </label>
    </div>

    <div v-if="chosen" class="question">
      <p class="lead">
        Importing {{ chosen.name }} replaces this Household entirely. {{ replacing }}
      </p>
      <div class="actions">
        <button class="destructive" type="button" @click="confirm">Replace this Household</button>
        <button class="button-quiet" type="button" @click="chosen = undefined">Keep it</button>
      </div>
    </div>

    <p v-if="imported" class="note">The Household in the file is the one on screen.</p>
    <p v-if="failure" class="failure note">{{ failure }}</p>
  </div>
</template>

<style scoped>
.file {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note {
  margin: 0;
  font-size: 13px;
}

.lead {
  margin: 0;
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.choose {
  cursor: pointer;
}

.choose input {
  display: none;
}

.question {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 0.5px solid var(--hairline);
}

.destructive {
  padding: 6px 10px;
  font-size: 13px;
  color: var(--fire-bright);
  background: none;
  border: 0.5px solid var(--fire-bright);
}

.destructive:hover {
  color: var(--page);
  background: var(--fire-bright);
}

.failure {
  color: var(--fire-bright);
}
</style>

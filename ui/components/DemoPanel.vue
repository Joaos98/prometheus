<script setup lang="ts">
/**
 * What the demo has to say for itself: where the Household is kept, that nothing is sent
 * anywhere, and the two ways out of the demo — take the file to a deployment of your own,
 * or put the sample Household back and start again.
 *
 * It is offered only where there is a Household to start from, which is the demo build
 * alone. The self-hosted app has no seed and so is never shown this.
 */
import { ref } from 'vue'
import { useChanges } from '../changes.js'
import { useHousehold } from '../household.js'

const { reset } = useHousehold()
const { failure, report } = useChanges()

const asking = ref(false)

async function putItBack(): Promise<void> {
  if (!(await report(reset()))) return
  asking.value = false
}
</script>

<template>
  <div class="demo">
    <p class="muted note">
      This is the demo. The Household lives in this browser and goes nowhere else — there is
      nothing running behind it, so nothing sees what you type and nothing can go down. Every
      part of Prometheus works here; it is the same engine the self-hosted app runs.
    </p>
    <p class="muted note">
      What you build here is yours to keep: export it from the Household file and import it
      into your own deployment.
    </p>

    <div class="actions">
      <button class="button-quiet" type="button" @click="asking = !asking">
        Reset the demo
      </button>
    </div>

    <div v-if="asking" class="question">
      <p class="lead">
        Resetting runs the sample Household afresh. Everything you have changed here goes, and
        nothing of it can be recovered — export it first if you want to keep it.
      </p>
      <div class="actions">
        <button class="destructive" type="button" @click="putItBack">
          Reset the demo
        </button>
        <button class="button-quiet" type="button" @click="asking = false">Keep what I have</button>
      </div>
    </div>

    <p v-if="failure" class="failure note">{{ failure }}</p>
  </div>
</template>

<style scoped>
.demo {
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

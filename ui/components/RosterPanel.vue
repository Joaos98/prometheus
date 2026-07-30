<script setup lang="ts">
import { ref } from 'vue'
import type { Household } from '../../domain/index.js'
import { useHousehold } from '../household.js'

defineProps<{ household: Household }>()

const { addRosterMember, deactivateRosterMember, reactivateRosterMember } = useHousehold()

const name = ref('')
const failure = ref<string | undefined>(undefined)

async function attempt(change: Promise<void>): Promise<void> {
  failure.value = undefined
  try {
    await change
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  }
}

async function add(): Promise<void> {
  await attempt(addRosterMember(name.value))
  name.value = ''
}
</script>

<template>
  <div class="roster">
    <p class="muted note">
      The Roster is the Household's full list of people, past and present — distinct from a
      Month's own members. Deactivating someone here changes no Month that already exists;
      only Months opened afterwards stop including them.
    </p>

    <ul class="members">
      <li v-for="member in household.roster" :key="member.id">
        <span :class="{ inactive: !member.active }">{{ member.name }}</span>
        <button
          v-if="member.active"
          class="button-quiet"
          type="button"
          @click="attempt(deactivateRosterMember(member.id))"
        >
          Deactivate
        </button>
        <button
          v-else
          class="button-quiet"
          type="button"
          @click="attempt(reactivateRosterMember(member.id))"
        >
          Reactivate
        </button>
      </li>
    </ul>

    <form class="add-form" @submit.prevent="add">
      <input v-model="name" type="text" placeholder="Add a member" aria-label="New member name" />
      <button class="button-primary" type="submit">Add</button>
    </form>

    <p v-if="failure" class="failure note">{{ failure }}</p>
  </div>
</template>

<style scoped>
.roster {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note {
  margin: 0;
  font-size: 13px;
}

.members {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.members li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.inactive {
  color: var(--text-muted);
  text-decoration: line-through;
}

.add-form {
  display: flex;
  gap: 8px;
}

.add-form input {
  flex: 1;
}

.failure {
  margin: 0;
  color: var(--fire-bright);
}
</style>

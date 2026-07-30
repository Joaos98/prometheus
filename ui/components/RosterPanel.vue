<script setup lang="ts">
import { ref } from 'vue'
import type { Household } from '../../domain/index.js'
import { useChanges } from '../changes.js'
import { useHousehold } from '../household.js'

defineProps<{ household: Household }>()

const { addRosterMember, deactivateRosterMember, reactivateRosterMember } = useHousehold()
const { failure, report } = useChanges()

const name = ref('')

/** The field is emptied only once somebody is on the Roster under that name. */
async function add(): Promise<void> {
  if (!(await report(addRosterMember(name.value)))) return
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
          @click="report(deactivateRosterMember(member.id))"
        >
          Deactivate
        </button>
        <button
          v-else
          class="button-quiet"
          type="button"
          @click="report(reactivateRosterMember(member.id))"
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

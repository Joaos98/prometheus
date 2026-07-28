<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  members: { id: string; name: string; joinedFrom?: string; departedFrom?: string }[];
  api: {
    addMember(name: string, joinedFrom?: string): Promise<{ id: string; name: string }>;
  };
}>();

const showForm = ref(false);
const newName = ref("");
const newJoined = ref("");

async function submit() {
  if (!newName.value.trim()) return;
  await props.api.addMember(newName.value.trim(), newJoined.value || undefined);
  newName.value = ""; newJoined.value = ""; showForm.value = false;
}
</script>

<template>
  <div class="page-header"><h2>Members</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="submit" class="add-form">
    <div class="field"><span class="field-label">Name</span><input v-model="newName" placeholder="Member name" class="input" /></div>
    <div class="field"><span class="field-label">Joined from</span><input v-model="newJoined" type="month" class="input input-sm" /></div>
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div class="card">
    <ul class="ov-list">
      <li v-for="m in members" :key="m.id" class="ov-row">
        <span>{{ m.name }}</span>
        <span v-if="m.joinedFrom" class="muted">since {{ m.joinedFrom }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  members: { id: string; name: string }[];
  api: { addMember(name: string): Promise<{ id: string; name: string }>; deleteMember(id: string): Promise<unknown> };
}>();

const showForm = ref(false);
const newName = ref("");

async function submit() { if (!newName.value.trim()) return; await props.api.addMember(newName.value.trim()); newName.value = ""; showForm.value = false; }
async function remove(id: string) { await props.api.deleteMember(id); }
</script>

<template>
  <div class="page-header"><h2>Members</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="submit" class="add-form">
    <input v-model="newName" placeholder="Member name" class="input" />
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div class="card">
    <ul class="ov-list">
      <li v-for="m in members" :key="m.id" class="ov-row">
        <span>{{ m.name }}</span>
        <button @click="remove(m.id)" class="btn-ghost danger">Remove</button>
      </li>
    </ul>
  </div>
</template>

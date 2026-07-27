<script setup lang="ts">
import type { Member } from "@prometheus/engine";
import { ref } from "vue";
import MonthPicker from "../components/MonthPicker.vue";

const props = defineProps<{
  members: Member[];
  displayMonth: string;
  currentMonth: string;
  api: {
    submitMember(name: string, joinedFrom?: string): Promise<Member>;
    departMember(id: string, eff: string): Promise<void>;
    renameMember(id: string, name: string): Promise<void>;
  };
}>();

const showForm = ref(false);
const newMemberName = ref(""); const newMemberJoinedFrom = ref("");
const editingMemberId = ref<string | null>(null); const editingMemberName = ref("");
const departingMemberId = ref<string | null>(null); const departingEff = ref("");

async function submitMember() {
  const n = newMemberName.value.trim(); if (!n) return;
  await props.api.submitMember(n, newMemberJoinedFrom.value || undefined);
  newMemberName.value = ""; newMemberJoinedFrom.value = ""; showForm.value = false;
}
async function doDepart(id: string) { await props.api.departMember(id, departingEff.value); departingMemberId.value = null; }
async function startRename(m: Member) { editingMemberId.value = m.id; editingMemberName.value = m.name; }
async function commitRename(id: string) { const n = editingMemberName.value.trim(); if (!n) return; await props.api.renameMember(id, n); editingMemberId.value = null; }
</script>

<template>
  <div class="page-header"><h2>Members</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="submitMember" class="add-form">
    <input v-model="newMemberName" placeholder="Member name" class="input" />
    <MonthPicker v-model="newMemberJoinedFrom" placeholder="Joined in" />
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div class="card">
    <ul class="ov-list">
      <li v-for="m in members" :key="m.id" class="ov-row">
        <template v-if="editingMemberId === m.id">
          <input v-model="editingMemberName" class="input input-sm" />
          <button @click="commitRename(m.id)" class="btn-ghost">Save</button>
          <button @click="editingMemberId = null" class="btn-ghost">Cancel</button>
        </template>
        <template v-else>
          <span>{{ m.name }}</span>
          <span v-if="m.joinedFrom" class="muted">since {{ m.joinedFrom }}</span>
          <span v-if="m.departedFrom" class="tag ended">departed {{ m.departedFrom }}</span>
          <button @click="startRename(m)" class="btn-ghost">Rename</button>
          <template v-if="m.departedFrom === undefined">
            <template v-if="departingMemberId === m.id">
              <MonthPicker v-model="departingEff" placeholder="Departed in" />
              <button @click="doDepart(m.id)" class="btn-ghost danger">Confirm Depart</button>
              <button @click="departingMemberId = null" class="btn-ghost">Cancel</button>
            </template>
            <button v-else @click="departingMemberId = m.id" class="btn-ghost danger">Depart</button>
          </template>
        </template>
      </li>
    </ul>
  </div>
</template>

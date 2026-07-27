<script setup lang="ts">
import type { Member } from "@prometheus/engine";

defineProps<{
  members: Member[];
  showForm: boolean;
  newMemberName: string;
  newMemberJoinedFrom: string;
  editingMemberId: string | null;
  editingMemberName: string;
  departingMemberEffFrom: Record<string, string>;
  departingMember: string | null;
}>();
const emit = defineEmits<{
  (e: 'toggleForm'): void;
  (e: 'submitMember'): void;
  (e: 'departMember', id: string): void;
  (e: 'startRename', m: Member): void;
  (e: 'commitRename', id: string): void;
  (e: 'cancelRename'): void;
  (e: 'update:newMemberName', v: string): void;
  (e: 'update:newMemberJoinedFrom', v: string): void;
  (e: 'update:editingMemberName', v: string): void;
  (e: 'update:departingMemberEffFrom', id: string, v: string): void;
  (e: 'startDepart', id: string): void;
  (e: 'cancelDepart'): void;
}>();
</script>

<template>
  <div class="page-header"><h2>Members</h2><button @click="emit('toggleForm')" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add' }}</button></div>
  <form v-if="showForm" @submit.prevent="emit('submitMember')" class="add-form">
    <input :value="newMemberName" @input="emit('update:newMemberName', ($event.target as HTMLInputElement).value)" placeholder="Member name" class="input" />
    <input :value="newMemberJoinedFrom" @input="emit('update:newMemberJoinedFrom', ($event.target as HTMLInputElement).value)" placeholder="From YYYY-MM" size="7" class="input input-sm" />
    <button type="submit" class="btn-accent">Save</button>
  </form>
  <div class="card">
    <ul class="ov-list">
      <li v-for="m in members" :key="m.id" class="ov-row">
        <template v-if="editingMemberId === m.id">
          <input :value="editingMemberName" @input="emit('update:editingMemberName', ($event.target as HTMLInputElement).value)" class="input input-sm" />
          <button @click="emit('commitRename', m.id)" class="btn-ghost">Save</button>
          <button @click="emit('cancelRename')" class="btn-ghost">Cancel</button>
        </template>
        <template v-else>
          <span>{{ m.name }}</span>
          <span v-if="m.joinedFrom" class="muted">since {{ m.joinedFrom }}</span>
          <span v-if="m.departedFrom" class="tag ended">departed {{ m.departedFrom }}</span>
          <button @click="emit('startRename', m)" class="btn-ghost">Rename</button>
          <template v-if="m.departedFrom === undefined">
            <template v-if="departingMember === m.id">
              <input :value="departingMemberEffFrom[m.id] ?? ''" @input="emit('update:departingMemberEffFrom', m.id, ($event.target as HTMLInputElement).value)" placeholder="Depart YYYY-MM" size="7" class="input input-xs" />
              <button @click="emit('departMember', m.id); emit('cancelDepart')" class="btn-ghost danger">Confirm Depart</button>
              <button @click="emit('cancelDepart')" class="btn-ghost">Cancel</button>
            </template>
            <button v-else @click="emit('startDepart', m.id)" class="btn-ghost danger">Depart</button>
          </template>
        </template>
      </li>
    </ul>
  </div>
</template>

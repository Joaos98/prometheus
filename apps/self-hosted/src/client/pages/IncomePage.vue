<script setup lang="ts">
import type { IncomeProfile } from "@prometheus/data";
import { ref } from "vue";

const props = defineProps<{
  members: { id: string; name: string }[];
  profiles: IncomeProfile[];
  currency: string;
  api: {
    addIncomeProfile(memberId: string, name: string, amountCents: number, restrictedUse: boolean): Promise<IncomeProfile>;
    updateIncomeProfile(id: string, updates: Record<string, unknown>): Promise<unknown>;
    deleteIncomeProfile(id: string): Promise<unknown>;
    addOneOffIncome(memberId: string, name: string, amountCents: number, month: string, restrictedUse: boolean): Promise<unknown>;
  };
}>();

const showForm = ref(false);
const newMemberId = ref("");
const newName = ref("");
const newAmount = ref("");
const newRestricted = ref(false);
const editingId = ref<string | null>(null);
const editingAmount = ref("");
const editingName = ref("");

const fmt = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: props.currency }).format(cents / 100);

function profilesForMember(mid: string) { return props.profiles.filter(p => p.memberId === mid); }

async function submit() {
  const a = parseFloat(newAmount.value);
  if (!newMemberId.value || !newName.value.trim() || isNaN(a)) return;
  await props.api.addIncomeProfile(newMemberId.value, newName.value.trim(), Math.round(a * 100), newRestricted.value);
  newName.value = ""; newAmount.value = ""; newRestricted.value = false; showForm.value = false;
}

function startEdit(p: IncomeProfile) { editingId.value = p.id; editingAmount.value = String(p.amountCents / 100); editingName.value = p.name; }
async function saveEdit(id: string) {
  const a = parseFloat(editingAmount.value);
  if (isNaN(a)) return;
  await props.api.updateIncomeProfile(id, { name: editingName.value.trim(), amountCents: Math.round(a * 100) });
  editingId.value = null;
}
async function removeProfile(id: string) { await props.api.deleteIncomeProfile(id); }
</script>

<template>
  <div class="page-header"><h2>Income</h2><button @click="showForm = !showForm" class="btn-accent">{{ showForm ? 'Cancel' : '+ Add Profile' }}</button></div>

  <form v-if="showForm" @submit.prevent="submit" class="add-form">
    <select v-model="newMemberId" class="input"><option value="" disabled>Member</option><option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option></select>
    <input v-model="newName" placeholder="Source name" class="input" />
    <input v-model="newAmount" placeholder="Amount" type="number" step="0.01" min="0" class="input" />
    <label class="check"><input type="checkbox" v-model="newRestricted" /> Restricted</label>
    <button type="submit" class="btn-accent">Save</button>
  </form>

  <div v-for="m in members" :key="m.id" class="card">
    <h3 class="card-label" v-if="profilesForMember(m.id).length > 0">{{ m.name }}</h3>
    <ul class="ov-list">
      <li v-for="p in profilesForMember(m.id)" :key="p.id" class="ov-row">
        <template v-if="editingId === p.id">
          <input v-model="editingName" class="input input-sm" />
          <input v-model="editingAmount" type="number" step="0.01" min="0" class="input input-sm" />
          <button @click="saveEdit(p.id)" class="btn-ghost">Save</button>
          <button @click="editingId = null" class="btn-ghost">Cancel</button>
        </template>
        <template v-else>
          <span>{{ p.name }}</span>
          <span>{{ fmt(p.amountCents) }}</span>
          <span v-if="p.restrictedUse" class="tag">restricted</span>
          <button @click="startEdit(p)" class="btn-ghost">Edit</button>
          <button @click="removeProfile(p.id)" class="btn-ghost danger">Remove</button>
        </template>
      </li>
    </ul>
  </div>
</template>

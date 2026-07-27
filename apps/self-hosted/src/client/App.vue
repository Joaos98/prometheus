<script setup lang="ts">
import type { Member, MonthlySummary } from "@prometheus/engine";
import { onMounted, ref } from "vue";

const currency = ref<string | null>(null);
const members = ref<Member[]>([]);
const summary = ref<MonthlySummary | null>(null);
const loading = ref(true);
const appError = ref<string | null>(null);

const currencyValue = ref("USD");
const newMemberName = ref("");
const editingMemberId = ref<string | null>(null);
const editingMemberName = ref("");

async function unwrapError(r: Response): Promise<never> {
  const body = (await r.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? `HTTP ${r.status}`);
}

const request = {
  async get(url: string) {
    const r = await fetch(url);
    if (!r.ok) await unwrapError(r);
    return r.json() as unknown;
  },
  async post(url: string, body: unknown) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) await unwrapError(r);
    return r.json() as unknown;
  },
  async patch(url: string, body: unknown) {
    const r = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) await unwrapError(r);
    return r.json() as unknown;
  },
};

onMounted(async () => {
  try {
    const data = (await request.get("/api/household")) as {
      currency: string | null;
      members: Member[];
    };
    currency.value = data.currency;
    members.value = data.members;

    if (currency.value) {
      const month = new Date().toISOString().slice(0, 7);
      summary.value = (await request.get(
        `/api/summary?month=${month}`,
      )) as MonthlySummary;
    }
  } catch (e) {
    appError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});

async function submitCurrency(): Promise<void> {
  try {
    await request.post("/api/household/currency", {
      currency: currencyValue.value,
    });
    currency.value = currencyValue.value;
    const month = new Date().toISOString().slice(0, 7);
    summary.value = (await request.get(
      `/api/summary?month=${month}`,
    )) as MonthlySummary;
  } catch (e) {
    appError.value = e instanceof Error ? e.message : String(e);
  }
}

async function submitMember(): Promise<void> {
  const name = newMemberName.value.trim();
  if (!name) return;
  try {
    const member = (await request.post("/api/members", { name })) as Member;
    members.value = [...members.value, member];
    newMemberName.value = "";
  } catch (e) {
    appError.value = e instanceof Error ? e.message : String(e);
  }
}

function startRename(member: Member): void {
  editingMemberId.value = member.id;
  editingMemberName.value = member.name;
}

async function commitRename(id: string): Promise<void> {
  const name = editingMemberName.value.trim();
  if (!name) return;
  try {
    await request.patch(`/api/members/${id}`, { name });
    members.value = members.value.map((m) =>
      m.id === id ? { ...m, name } : m,
    );
    editingMemberId.value = null;
  } catch (e) {
    appError.value = e instanceof Error ? e.message : String(e);
  }
}

function cancelRename(): void {
  editingMemberId.value = null;
}

const formatCurrency = (cents: number, curr: string): string =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: curr }).format(
    cents / 100,
  );
</script>

<template>
  <main>
    <h1>Prometheus</h1>
    <p v-if="appError">Error: {{ appError }}</p>
    <p v-else-if="loading">Loading…</p>

    <template v-else-if="currency === null">
      <section>
        <h2>Household Setup</h2>
        <form @submit.prevent="submitCurrency">
          <label>
            Currency
            <input v-model="currencyValue" />
          </label>
          <button type="submit">Set Currency</button>
        </form>
      </section>
    </template>

    <template v-else-if="summary">
      <h2>{{ summary.month }}</h2>

      <section>
        <h2>Members</h2>
        <form @submit.prevent="submitMember">
          <input v-model="newMemberName" placeholder="Member name" />
          <button type="submit">Add</button>
        </form>
        <ul>
          <li v-for="member in members" :key="member.id">
            <template v-if="editingMemberId === member.id">
              <input v-model="editingMemberName" />
              <button @click="commitRename(member.id)">Save</button>
              <button @click="cancelRename">Cancel</button>
            </template>
            <template v-else>
              {{ member.name }}
              <button @click="startRename(member)">Rename</button>
            </template>
          </li>
        </ul>
      </section>

      <section>
        <h2>Shares</h2>
        <section v-for="member in summary.members" :key="member.memberId">
          <h3>{{ member.name }}</h3>
          <ul>
            <li v-for="share in member.shares" :key="share.expenseId">
              {{ share.expenseName }}:
              {{ formatCurrency(share.amountCents, summary.currency) }}
            </li>
          </ul>
          <p v-if="member.shares.length === 0">No shared expenses this Month.</p>
        </section>
      </section>
    </template>
  </main>
</template>

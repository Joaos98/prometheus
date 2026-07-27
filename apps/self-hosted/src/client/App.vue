<script setup lang="ts">
import type { IncomeSource, Member, MonthlySummary } from "@prometheus/engine";
import { onMounted, ref } from "vue";

const currency = ref<string | null>(null);
const members = ref<Member[]>([]);
const incomeSources = ref<IncomeSource[]>([]);
const summary = ref<MonthlySummary | null>(null);
const loading = ref(true);
const appError = ref<string | null>(null);

const currencyValue = ref("USD");
const newMemberName = ref("");
const editingMemberId = ref<string | null>(null);
const editingMemberName = ref("");

const newSourceMemberId = ref("");
const newSourceName = ref("");
const newSourceAmount = ref("");
const newSourceEffectiveFrom = ref("");
const editingSourceId = ref<string | null>(null);
const editingSourceAmount = ref("");
const editingSourceEffectiveFrom = ref("");

const currentMonth = () => new Date().toISOString().slice(0, 7);

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
      incomeSources: IncomeSource[];
    };
    currency.value = data.currency;
    members.value = data.members;
    incomeSources.value = data.incomeSources;

    if (currency.value) {
      const month = currentMonth();
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

function sourcesForMember(memberId: string): IncomeSource[] {
  return incomeSources.value.filter((s) => s.memberId === memberId);
}

const latestAmount = (source: IncomeSource): number => {
  const sorted = [...source.timeline].sort(
    (a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom),
  );
  return sorted[0]?.amountCents ?? 0;
};

async function submitCurrency(): Promise<void> {
  try {
    await request.post("/api/household/currency", {
      currency: currencyValue.value,
    });
    currency.value = currencyValue.value;
    const month = currentMonth();
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

async function submitIncomeSource(): Promise<void> {
  const memberId = newSourceMemberId.value;
  const name = newSourceName.value.trim();
  const amountDollars = parseFloat(newSourceAmount.value);
  const effectiveFrom = newSourceEffectiveFrom.value;
  if (!memberId || !name || isNaN(amountDollars) || !effectiveFrom) return;
  try {
    const source = (await request.post("/api/income-sources", {
      memberId,
      name,
      amountCents: Math.round(amountDollars * 100),
      effectiveFrom,
    })) as IncomeSource;
    incomeSources.value = [...incomeSources.value, source];
    newSourceName.value = "";
    newSourceAmount.value = "";
    newSourceEffectiveFrom.value = "";
  } catch (e) {
    appError.value = e instanceof Error ? e.message : String(e);
  }
}

function startEditSource(source: IncomeSource): void {
  editingSourceId.value = source.id;
  editingSourceAmount.value = String(latestAmount(source) / 100);
  editingSourceEffectiveFrom.value = "";
}

async function commitEditSource(): Promise<void> {
  const id = editingSourceId.value;
  const amountDollars = parseFloat(editingSourceAmount.value);
  const effectiveFrom = editingSourceEffectiveFrom.value;
  if (!id || isNaN(amountDollars) || !effectiveFrom) return;
  try {
    await request.post(`/api/income-sources/${id}/amount`, {
      amountCents: Math.round(amountDollars * 100),
      effectiveFrom,
    });
    // Reload to get updated timeline
    const data = (await request.get("/api/household")) as {
      incomeSources: IncomeSource[];
    };
    incomeSources.value = data.incomeSources;
    editingSourceId.value = null;
  } catch (e) {
    appError.value = e instanceof Error ? e.message : String(e);
  }
}

async function endSource(id: string): Promise<void> {
  try {
    await request.post(`/api/income-sources/${id}/end`, {
      effectiveFrom: currentMonth(),
    });
    const data = (await request.get("/api/household")) as {
      incomeSources: IncomeSource[];
    };
    incomeSources.value = data.incomeSources;
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
        <h2>Income</h2>

        <section v-for="member in summary.members" :key="member.memberId">
          <h3>{{ member.name }} — {{ formatCurrency(member.incomeCents, summary.currency) }}</h3>
          <ul>
            <li
              v-for="source in sourcesForMember(member.memberId)"
              :key="source.id"
            >
              <template v-if="editingSourceId === source.id">
                Amount <input v-model="editingSourceAmount" />
                From <input v-model="editingSourceEffectiveFrom" placeholder="YYYY-MM" />
                <button @click="commitEditSource()">Save</button>
              </template>
              <template v-else>
                <span
                  v-if="source.endedFrom !== undefined"
                  style="text-decoration: line-through"
                >{{ source.name }}: {{ formatCurrency(latestAmount(source), summary.currency) }}
                  (ended {{ source.endedFrom }})</span>
                <span v-else>{{ source.name }}:
                  {{ formatCurrency(latestAmount(source), summary.currency) }}
                  (from {{ source.timeline[source.timeline.length - 1]?.effectiveFrom }})</span>
                <button @click="startEditSource(source)">Update</button>
                <button
                  v-if="source.endedFrom === undefined"
                  @click="endSource(source.id)"
                >End</button>
              </template>
            </li>
          </ul>
          <p v-if="sourcesForMember(member.memberId).length === 0">
            No income recorded.
          </p>
        </section>

        <form @submit.prevent="submitIncomeSource">
          <select v-model="newSourceMemberId">
            <option value="" disabled>Member</option>
            <option v-for="member in members" :key="member.id" :value="member.id">
              {{ member.name }}
            </option>
          </select>
          <input v-model="newSourceName" placeholder="Source name" />
          <input v-model="newSourceAmount" placeholder="Amount" type="number" step="0.01" min="0" />
          <input v-model="newSourceEffectiveFrom" placeholder="From (YYYY-MM)" />
          <button type="submit">Add Income</button>
        </form>
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

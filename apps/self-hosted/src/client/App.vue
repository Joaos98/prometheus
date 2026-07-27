<script setup lang="ts">
import type {
  Expense,
  ExpenseAmount,
  IncomeSource,
  Member,
  MonthlySummary,
  PendingExpense,
} from "@prometheus/engine";
import { onMounted, ref } from "vue";

const currency = ref<string | null>(null);
const members = ref<Member[]>([]);
const incomeSources = ref<IncomeSource[]>([]);
const expenses = ref<Expense[]>([]);
const expenseAmounts = ref<ExpenseAmount[]>([]);
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

const newExpenseName = ref("");
const newExpenseParticipants = ref<string[]>([]);
const newExpenseSplitRule = ref("even");
const newExpenseEffectiveFrom = ref("");
const expenseAmountValues = ref<Record<string, string>>({});
const endingExpenseEffectiveFrom = ref<Record<string, string>>({});

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
      expenses: Expense[];
      expenseAmounts: ExpenseAmount[];
    };
    currency.value = data.currency;
    members.value = data.members;
    incomeSources.value = data.incomeSources;
    expenses.value = data.expenses;
    expenseAmounts.value = data.expenseAmounts;

    if (currency.value) {
      summary.value = (await request.get(
        `/api/summary?month=${currentMonth()}`,
      )) as MonthlySummary;
    }
  } catch (e) {
    appError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});

async function reloadExpenseData(): Promise<void> {
  const data = (await request.get("/api/household")) as {
    expenses: Expense[];
    expenseAmounts: ExpenseAmount[];
  };
  expenses.value = data.expenses;
  expenseAmounts.value = data.expenseAmounts;
}

async function refreshSummary(): Promise<void> {
  summary.value = (await request.get(
    `/api/summary?month=${currentMonth()}`,
  )) as MonthlySummary;
}

function activeExpenses(): Expense[] {
  const month = currentMonth();
  return expenses.value.filter(
    (e) =>
      e.effectiveFrom <= month &&
      (e.endedFrom === undefined || e.endedFrom > month),
  );
}

function expenseHasAmount(expenseId: string): boolean {
  return expenseAmounts.value.some(
    (a) => a.expenseId === expenseId && a.month === currentMonth(),
  );
}

function sourcesForMember(memberId: string): IncomeSource[] {
  return incomeSources.value.filter((s) => s.memberId === memberId);
}

const latestAmount = (source: IncomeSource): number => {
  const sorted = [...source.timeline].sort(
    (a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom),
  );
  return sorted[0]?.amountCents ?? 0;
};

function toggleParticipant(memberId: string): void {
  const idx = newExpenseParticipants.value.indexOf(memberId);
  if (idx >= 0) {
    newExpenseParticipants.value.splice(idx, 1);
  } else {
    newExpenseParticipants.value.push(memberId);
  }
}

async function submitCurrency(): Promise<void> {
  try {
    await request.post("/api/household/currency", {
      currency: currencyValue.value,
    });
    currency.value = currencyValue.value;
    await refreshSummary();
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

async function submitExpense(): Promise<void> {
  const name = newExpenseName.value.trim();
  const participants = [...newExpenseParticipants.value];
  const effectiveFrom = newExpenseEffectiveFrom.value;
  if (!name || participants.length === 0 || !effectiveFrom) return;
  try {
    const expense = (await request.post("/api/expenses", {
      name,
      participants,
      splitRule: { method: newExpenseSplitRule.value },
      effectiveFrom,
    })) as Expense;
    expenses.value = [...expenses.value, expense];
    newExpenseName.value = "";
    newExpenseParticipants.value = [];
    newExpenseSplitRule.value = "even";
    newExpenseEffectiveFrom.value = "";
  } catch (e) {
    appError.value = e instanceof Error ? e.message : String(e);
  }
}

async function submitExpenseAmount(expenseId: string): Promise<void> {
  const raw = expenseAmountValues.value[expenseId] ?? "";
  const amountDollars = parseFloat(raw);
  if (isNaN(amountDollars)) return;
  try {
    await request.post(`/api/expenses/${expenseId}/amount`, {
      month: currentMonth(),
      amountCents: Math.round(amountDollars * 100),
    });
    delete expenseAmountValues.value[expenseId];
    await reloadExpenseData();
    await refreshSummary();
  } catch (e) {
    appError.value = e instanceof Error ? e.message : String(e);
  }
}

async function endExpense(id: string): Promise<void> {
  const eff = endingExpenseEffectiveFrom.value[id] ?? currentMonth();
  try {
    await request.post(`/api/expenses/${id}/end`, {
      effectiveFrom: eff,
    });
    delete endingExpenseEffectiveFrom.value[id];
    await reloadExpenseData();
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
          <label>Currency <input v-model="currencyValue" /></label>
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
            <li v-for="source in sourcesForMember(member.memberId)" :key="source.id">
              <template v-if="editingSourceId === source.id">
                Amount <input v-model="editingSourceAmount" />
                From <input v-model="editingSourceEffectiveFrom" placeholder="YYYY-MM" />
                <button @click="commitEditSource()">Save</button>
              </template>
              <template v-else>
                <span v-if="source.endedFrom !== undefined" style="text-decoration: line-through">
                  {{ source.name }}: {{ formatCurrency(latestAmount(source), summary.currency) }}
                  (ended {{ source.endedFrom }})
                </span>
                <span v-else>
                  {{ source.name }}: {{ formatCurrency(latestAmount(source), summary.currency) }}
                  (from {{ source.timeline[source.timeline.length - 1]?.effectiveFrom }})
                </span>
                <button @click="startEditSource(source)">Update</button>
                <button v-if="source.endedFrom === undefined" @click="endSource(source.id)">End</button>
              </template>
            </li>
          </ul>
          <p v-if="sourcesForMember(member.memberId).length === 0">No income recorded.</p>
        </section>

        <form @submit.prevent="submitIncomeSource">
          <select v-model="newSourceMemberId">
            <option value="" disabled>Member</option>
            <option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }}</option>
          </select>
          <input v-model="newSourceName" placeholder="Source name" />
          <input v-model="newSourceAmount" placeholder="Amount" type="number" step="0.01" min="0" />
          <input v-model="newSourceEffectiveFrom" placeholder="From (YYYY-MM)" />
          <button type="submit">Add Income</button>
        </form>
      </section>

      <section>
        <h2>Expenses</h2>

        <div v-if="summary.pendingExpenses.length > 0">
          <h3>Pending (unentered this Month)</h3>
          <ul>
            <li v-for="pe in summary.pendingExpenses" :key="pe.expenseId">
              {{ pe.expenseName }}
            </li>
          </ul>
        </div>

        <div v-if="summary.fallbackExpenses.length > 0">
          <h3>Split Fallbacks (even substitute)</h3>
          <ul>
            <li v-for="fe in summary.fallbackExpenses" :key="fe.expenseId">
              {{ fe.expenseName }} — no participant had income; split evenly
            </li>
          </ul>
        </div>

        <section v-for="member in summary.members" :key="member.memberId">
          <h3>{{ member.name }}</h3>
          <ul>
            <li v-for="share in member.shares" :key="share.expenseId">
              {{ share.expenseName }}: {{ formatCurrency(share.amountCents, summary.currency) }}
            </li>
          </ul>
          <p v-if="member.shares.length === 0">No shared expenses this Month.</p>
        </section>

        <section>
          <h3>All Expenses</h3>
          <ul>
            <li v-for="expense in activeExpenses()" :key="expense.id">
              <strong>
                <span v-if="expense.endedFrom !== undefined" style="text-decoration: line-through">{{ expense.name }}</span>
                <span v-else>{{ expense.name }}</span>
              </strong>
              (participants: {{ expense.participants.join(", ") }})
              <template v-if="expenseHasAmount(expense.id)">
                <br />Amount entered for {{ currentMonth() }}
              </template>
              <template v-else>
                <br />
                Amount {{ currentMonth() }}
                <input v-model="expenseAmountValues[expense.id]" placeholder="$" type="number" step="0.01" min="0" />
                <button @click="submitExpenseAmount(expense.id)">Save</button>
              </template>
              <template v-if="expense.endedFrom === undefined">
                <br />End from
                <input v-model="endingExpenseEffectiveFrom[expense.id]" placeholder="YYYY-MM" />
                <button @click="endExpense(expense.id)">End</button>
              </template>
            </li>
          </ul>
          <p v-if="activeExpenses().length === 0">No expenses defined.</p>
        </section>

        <form @submit.prevent="submitExpense">
          <input v-model="newExpenseName" placeholder="Expense name" />
          <fieldset>
            <legend>Participants</legend>
            <label v-for="member in members" :key="member.id">
              <input
                type="checkbox"
                :value="member.id"
                @change="toggleParticipant(member.id)"
              />
              {{ member.name }}
            </label>
          </fieldset>
          <label>
            Split:
            <select v-model="newExpenseSplitRule">
              <option value="even">Even</option>
              <option value="proportional">Proportional to Income</option>
            </select>
          </label>
          <input v-model="newExpenseEffectiveFrom" placeholder="From (YYYY-MM)" />
          <button type="submit">Add Expense</button>
        </form>
      </section>

      <section>
        <h2>Leftover</h2>
        <section v-for="member in summary.members" :key="member.memberId">
          <h3>{{ member.name }}</h3>
          <p>
            Income: {{ formatCurrency(member.incomeCents, summary.currency) }}
            − Shares: {{ formatCurrency(member.totalCents, summary.currency) }}
            = {{ formatCurrency(member.leftoverCents, summary.currency) }}
          </p>
        </section>
      </section>
    </template>
  </main>
</template>

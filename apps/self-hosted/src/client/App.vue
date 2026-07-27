<script setup lang="ts">
import type { MonthlySummary } from "@prometheus/engine";
import { onMounted, ref } from "vue";

const summary = ref<MonthlySummary | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const response = await fetch(`/api/summary?month=${month}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    summary.value = (await response.json()) as MonthlySummary;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});

const format = (cents: number, currency: string): string =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    cents / 100,
  );
</script>

<template>
  <main>
    <h1>Prometheus</h1>
    <p v-if="error">Failed to load: {{ error }}</p>
    <p v-else-if="!summary">Loading…</p>
    <template v-else>
      <h2>{{ summary.month }}</h2>
      <section v-for="member in summary.members" :key="member.memberId">
        <h3>{{ member.name }}</h3>
        <ul>
          <li v-for="share in member.shares" :key="share.expenseId">
            {{ share.expenseName }}:
            {{ format(share.amountCents, summary.currency) }}
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

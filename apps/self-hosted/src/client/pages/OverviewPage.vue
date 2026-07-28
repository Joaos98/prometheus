<script setup lang="ts">
import type { MonthlySummary } from "@prometheus/engine";

defineProps<{ summary: MonthlySummary }>();

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
</script>

<template>
  <div class="balance-row">
    <div class="balance-card" v-for="m in summary.members" :key="m.memberId">
      <span class="balance-label">{{ m.name }}</span>
      <span class="balance-value" :class="{ negative: m.leftoverCents < 0 }">
        {{ fmt(m.leftoverCents, summary.currency) }}
      </span>
    </div>
  </div>

  <div class="card">
    <h3 class="card-label">Expenses</h3>
    <ul class="list">
      <li v-for="m in summary.members" :key="m.memberId" class="list-row">
        <span>{{ m.name }}</span>
        <ul class="share-list">
          <li v-for="s in m.shares" :key="s.expenseId">
            {{ s.expenseName }}: {{ fmt(s.amountCents, summary.currency) }}
          </li>
        </ul>
        <span>Income: {{ fmt(m.incomeCents, summary.currency) }}</span>
        <span class="leftover">Leftover: {{ fmt(m.leftoverCents, summary.currency) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { MonthlySummary } from "@prometheus/engine";
import { ref } from "vue";

defineProps<{ summary: MonthlySummary }>();
const includeRestricted = ref(false);

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
</script>

<template>
  <div class="card" style="margin-bottom:12px">
    <label class="check"><input type="checkbox" v-model="includeRestricted" /> Include restricted income in Leftover</label>
  </div>

  <div class="balance-row">
    <div class="balance-card" v-for="m in summary.members" :key="m.memberId">
      <span class="balance-label">{{ m.name }}</span>
      <span class="balance-value" :class="{ negative: (includeRestricted ? m.incomeCents - m.totalCents : m.leftoverCents) < 0 }">
        {{ fmt(includeRestricted ? m.incomeCents - m.totalCents : m.leftoverCents, summary.currency) }}
      </span>
      <span class="balance-detail">Income {{ fmt(m.incomeCents, summary.currency) }} &minus; Shares {{ fmt(m.totalCents, summary.currency) }}</span>
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
      </li>
    </ul>
  </div>
</template>

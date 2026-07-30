<script setup lang="ts">
defineProps<{ was: string; becomes: string }>()

const emit = defineEmits<{ continued: []; repurposed: []; cancel: [] }>()
</script>

<template>
  <section class="question" role="group" :aria-label="`Renaming ${was}`">
    <p class="asked">Is this still the same Expense?</p>

    <p class="muted note">
      <strong>{{ was }}</strong> came from the Previous Month, and it is being called
      <strong>{{ becomes }}</strong> here. That could mean the same cost under a new name, or one
      cost ending and another beginning in its place — nothing in the row says which, so it is
      worth asking before its history follows the new name.
    </p>

    <div class="answers">
      <button class="button-primary" type="button" @click="emit('continued')">
        Same Expense — keep its history
      </button>
      <button class="button-quiet" type="button" @click="emit('repurposed')">
        A different Expense — start it here
      </button>
      <button class="button-quiet" type="button" @click="emit('cancel')">Back</button>
    </div>

    <p class="muted note">
      Keeping it carries this Month's row on the same thread as {{ was }}. Starting a different one
      ends that thread at the Previous Month, and later Months follow the new one.
    </p>
  </section>
</template>

<style scoped>
.question {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--page);
  border: 0.5px solid var(--fire);
  border-radius: var(--radius-control);
}

.asked {
  margin: 0;
  font-weight: 500;
}

.note {
  margin: 0;
  font-size: 12px;
}

.answers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.answers .button-primary {
  padding: 6px 14px;
}
</style>

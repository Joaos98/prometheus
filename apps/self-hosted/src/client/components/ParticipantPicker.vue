<script setup lang="ts">
const props = defineProps<{ members: { id: string; name: string }[]; modelValue: string[] }>();
const emit = defineEmits<{ 'update:modelValue': [v: string[]] }>();

function toggle(id: string) {
  const next = [...(props.modelValue ?? [])];
  const idx = next.indexOf(id);
  if (idx >= 0) next.splice(idx, 1);
  else next.push(id);
  emit("update:modelValue", next);
}
</script>

<template>
  <div class="pill-group">
    <button
      v-for="m in members"
      :key="m.id"
      class="pill"
      :class="{ selected: (modelValue ?? []).includes(m.id) }"
      :aria-pressed="(modelValue ?? []).includes(m.id)"
      :title="m.name"
      @click="toggle(m.id)"
    ><span v-if="(modelValue ?? []).includes(m.id)" class="pill-check">&#10003;</span>{{ m.name }}</button>
  </div>
</template>

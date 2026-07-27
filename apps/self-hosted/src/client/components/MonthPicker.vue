<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ modelValue: string; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: string] }>();

const open = ref(false);
const viewYear = ref(new Date().getFullYear());

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

function select(m: number, y: number) {
  emit("update:modelValue", `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}`);
  open.value = false;
}
function prevYear() { viewYear.value--; }
function nextYear() { viewYear.value++; }

function displayLabel(): string {
  const m = props.modelValue;
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return "";
  const monthNum = parseInt(m.slice(5), 10) - 1;
  const year = m.slice(0, 4);
  return `${months[monthNum]!} ${year}`;
}

const label = ref(displayLabel());
watch(() => props.modelValue, () => { label.value = displayLabel(); });
</script>

<template>
  <span class="mpicker" @blur="open = false">
    <span class="mpicker-trigger" @click="open = !open" tabindex="0" @keydown.space.prevent="open = !open">
      {{ label || props.placeholder || "Select month" }}
    </span>
    <div v-if="open" class="mpicker-drop">
      <div class="mpicker-head">
        <button @click="prevYear" class="mpicker-nav">&lsaquo;</button>
        <span class="mpicker-year">{{ viewYear }}</span>
        <button @click="nextYear" class="mpicker-nav">&rsaquo;</button>
      </div>
      <div class="mpicker-grid">
        <button
          v-for="(m, i) in months"
          :key="i"
          class="mpicker-month"
          :class="{
            active: props.modelValue === `${viewYear}-${String(i + 1).padStart(2, '0')}`,
            today: currentMonth === `${viewYear}-${String(i + 1).padStart(2, '0')}`
          }"
          @click="select(i, viewYear)"
        >{{ m }}</button>
      </div>
    </div>
  </span>
</template>

<style scoped>
.mpicker { position: relative; display: inline-flex; }
.mpicker-trigger {
  display: inline-flex; align-items: center; padding: 4px 8px; border: 0.5px solid var(--border);
  border-radius: 8px; cursor: pointer; font-size: 12px; color: var(--text);
  min-width: 90px; background: var(--bg); user-select: none;
}
.mpicker-trigger:hover { border-color: var(--text2); }
.mpicker-drop {
  position: absolute; top: 100%; left: 0; margin-top: 4px; z-index: 100;
  background: var(--card); border: 0.5px solid var(--border); border-radius: 8px;
  padding: 8px; min-width: 220px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}
.mpicker-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.mpicker-nav { all: unset; cursor: pointer; padding: 2px 8px; font-size: 18px; color: var(--text2); }
.mpicker-nav:hover { color: var(--text); }
.mpicker-year { font-size: 14px; font-weight: 500; color: var(--text); }
.mpicker-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.mpicker-month {
  all: unset; cursor: pointer; padding: 6px 4px; text-align: center; font-size: 12px;
  border-radius: 6px; color: var(--text2);
}
.mpicker-month:hover { background: rgba(255,255,255,0.04); color: var(--text); }
.mpicker-month.active { background: rgba(232,147,92,0.15); color: var(--accent); font-weight: 500; }
.mpicker-month.today { outline: 1px solid var(--ice); outline-offset: -1px; }
</style>

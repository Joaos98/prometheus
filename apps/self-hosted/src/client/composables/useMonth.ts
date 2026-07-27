import { ref, computed } from "vue";

export function useMonth() {
  const currentMonth = (): string => new Date().toISOString().slice(0, 7);
  const displayMonth = ref(currentMonth());
  const jumpMonth = ref("");

  const monthLabel = computed(() => {
    const [y, mn] = displayMonth.value.split("-").map(Number) as [number, number];
    return new Date(y, mn - 1).toLocaleString("default", { month: "long", year: "numeric" });
  });

  function shiftMonth(m: string, d: number): string {
    const [y, mn] = m.split("-").map(Number) as [number, number];
    const t = y * 12 + (mn - 1) + d;
    return `${String(Math.floor(t / 12)).padStart(4, "0")}-${String((t % 12) + 1).padStart(2, "0")}`;
  }
  const prev = () => { displayMonth.value = shiftMonth(displayMonth.value, -1); };
  const next = () => { displayMonth.value = shiftMonth(displayMonth.value, 1); };
  const today = () => { displayMonth.value = currentMonth(); };
  const jump = () => {
    const m = jumpMonth.value.trim();
    if (/^\d{4}-\d{2}$/.test(m)) { displayMonth.value = m; jumpMonth.value = ""; }
  };
  function backdateWarning(eff: string): string | null {
    if (!eff || eff >= displayMonth.value) return null;
    const [y, m] = eff.split("-").map(Number) as [number, number];
    const [cy, cm] = displayMonth.value.split("-").map(Number) as [number, number];
    return `Will recompute ${(cy - y) * 12 + (cm - m) + 1} months`;
  }

  return { displayMonth, jumpMonth, monthLabel, prev, next, today, jump, backdateWarning, currentMonth, shiftMonth };
}

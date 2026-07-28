import type { MonthlySummary } from "@prometheus/engine";
import type { Ref } from "vue";

export function useApi(displayMonth: Ref<string>) {
  const http = {
    async get(u: string) { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
    async post(u: string, b?: unknown) { const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
  };

  return {
    async fetchSummary(month?: string): Promise<MonthlySummary> {
      const m = month ?? displayMonth.value;
      return http.get(`/api/summary?month=${m}`) as Promise<MonthlySummary>;
    },
    async fetchHousehold() { return http.get("/api/household"); },
    async setCurrency(currency: string) { return http.post("/api/household/currency", { currency }); },
  };
}

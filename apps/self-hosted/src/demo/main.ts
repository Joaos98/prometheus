import { createApp } from "vue";
import { computeMonthlySummary } from "@prometheus/engine";
import { LocalStore } from "@prometheus/data";
import App from "../client/App.vue";
import "../client/style.css";

const store = new LocalStore();

(window as any).fetch = async (url: string, init?: RequestInit): Promise<Response> => {
  const u = new URL(url, "http://localhost");
  const body = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : undefined;

  let status = 200;
  let result: unknown = {};

  if (u.pathname === "/api/household" && init?.method === "POST" && u.pathname.endsWith("/currency")) {
    try { store.setCurrency(body!.currency as string); result = { currency: body!.currency }; } catch { status = 409; result = { error: "already set" }; }
  } else if (u.pathname === "/api/household" && !init?.method) {
    result = {
      currency: store.getCurrency(),
      members: store.getMembers(),
      incomeProfiles: store.getIncomeProfiles(),
      expenseTemplates: store.getExpenseTemplates(),
      goals: store.getGoals(),
    };
  } else if (u.pathname === "/api/summary") {
    const month = u.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    result = computeMonthlySummary(store.getMonthData(month));
  } else if (u.pathname === "/api/income-profiles" && init?.method === "POST") {
    result = store.addIncomeProfile(body!.memberId as string, body!.name as string, body!.amountCents as number, Boolean(body!.restrictedUse));
    status = 201;
  } else if (u.pathname === "/api/income-profiles") {
    result = store.getIncomeProfiles();
  } else if (u.pathname.startsWith("/api/income-profiles/") && init?.method === "PATCH") {
    const id = u.pathname.split("/").pop()!;
    store.updateIncomeProfile(id, body! as any);
    result = { id };
  } else if (u.pathname.startsWith("/api/income-profiles/") && init?.method === "DELETE") {
    store.removeIncomeProfile(u.pathname.split("/").pop()!);
    result = { deleted: true };
  } else if (u.pathname === "/api/income/snapshot") {
    const month = u.searchParams.get("month")!;
    store.snapshotProfile(month);
    result = { month };
  } else if (u.pathname === "/api/income" && init?.method === "POST") {
    store.addIncomeSnapshot({ month: body!.month as string, memberId: body!.memberId as string, name: body!.name as string, amountCents: body!.amountCents as number, restrictedUse: Boolean(body!.restrictedUse) });
    status = 201; result = { ok: true };
  } else if (u.pathname === "/api/expense-templates" && init?.method === "POST") {
    result = store.addExpenseTemplate(body!.name as string, body!.defaultParticipants as string[], body!.defaultSplitRule as any, body!.category as string); status = 201;
  } else if (u.pathname === "/api/expense-templates") {
    result = store.getExpenseTemplates();
  } else if (u.pathname.startsWith("/api/expense-templates/") && u.pathname.endsWith("/end")) {
    store.endExpenseTemplate(u.pathname.split("/")[3]!);
    result = { active: false };
  } else if (u.pathname === "/api/expenses/snapshot") {
    const month = u.searchParams.get("month")!;
    store.snapshotExpenses(month);
    result = { month };
  } else if (u.pathname === "/api/expense-snapshots") {
    store.addExpenseSnapshot({ month: body!.month as string, expenseId: body!.expenseId as string, name: "", amountCents: body!.amountCents as number, participants: body!.participants as string[], splitRule: body!.splitRule as any });
    status = 201; result = { ok: true };
  } else if (u.pathname === "/api/expenses/propagate") {
    const srcSnap = store.getExpenseSnapshots().find(s => s.expenseId === body!.expenseId && s.month === body!.sourceMonth);
    if (!srcSnap) { status = 404; result = { error: "not found" }; }
    else {
      const fwd = store.getExpenseSnapshots().filter(s => s.expenseId === body!.expenseId && s.month! > (body!.sourceMonth as string));
      for (const s of fwd) store.addExpenseSnapshot({ ...s, amountCents: srcSnap.amountCents, participants: srcSnap.participants, splitRule: srcSnap.splitRule });
      result = { propagated: fwd.length };
    }
  } else if (u.pathname === "/api/goals" && init?.method === "POST") {
    result = store.addGoal(body!.name as string, body!.participants as string[], body!.targetAmountCents as number | undefined, body!.startAmountCents as number | undefined); status = 201;
  } else if (u.pathname === "/api/goals") {
    result = store.getGoals();
  } else if (u.pathname.startsWith("/api/goals/") && u.pathname.endsWith("/end")) {
    store.endGoal(u.pathname.split("/")[3]!);
    result = { active: false };
  } else if (u.pathname === "/api/goal-contributions") {
    store.addGoalContribution(body!.goalId as string, body!.memberId as string, body!.month as string, body!.amountCents as number);
    status = 201; result = { ok: true };
  } else if (u.pathname === "/api/members" && init?.method === "POST") {
    result = store.addMember(body!.name as string, body!.joinedFrom as string | undefined); status = 201;
  } else if (u.pathname === "/api/members") {
    result = store.getMembers();
  }

  return new Response(JSON.stringify(result), { status, headers: { "Content-Type": "application/json" } });
};

createApp(App).mount("#app");

import type { MemberSummary, MonthData, MonthlySummary, Share } from "./types.js";

export function computeMonthlySummary(data: MonthData): MonthlySummary {
  const memberOrder = new Map<string, number>(
    data.members.map((m, i) => [m.id, i]),
  );

  const incomeByMember = new Map<string, number>();
  const restrictedByMember = new Map<string, number>();
  for (const snap of data.incomeSnapshots) {
    const prev = incomeByMember.get(snap.memberId) ?? 0;
    incomeByMember.set(snap.memberId, prev + snap.amountCents);
    if (snap.restrictedUse) {
      const rprev = restrictedByMember.get(snap.memberId) ?? 0;
      restrictedByMember.set(snap.memberId, rprev + snap.amountCents);
    }
  }

  const spendable = new Map<string, number>();
  for (const m of data.members) {
    spendable.set(m.id, (incomeByMember.get(m.id) ?? 0) - (restrictedByMember.get(m.id) ?? 0));
  }

  const sharesByMember = new Map<string, Share[]>();
  const pendingExpenses: { expenseId: string; expenseName: string }[] = [];
  const contributionByMember = new Map<string, number>();
  for (const m of data.members) sharesByMember.set(m.id, []);

  // Goal contributions
  const allContributions: Map<string, number> = new Map();
  const contributionThisMonth = new Set<string>();
  if (data.goalContributions) {
    for (const c of data.goalContributions) {
      if (c.month === data.month) {
        contributionThisMonth.add(c.goalId);
        const prev = contributionByMember.get(c.memberId) ?? 0;
        contributionByMember.set(c.memberId, prev + c.amountCents);
      }
      const total = (allContributions.get(c.goalId) ?? 0) + c.amountCents;
      allContributions.set(c.goalId, total);
    }
  }

  // Goal progress
  const goalProgress: GoalProgress[] = [];
  const pendingContributions: { goalId: string; goalName: string }[] = [];
  if (data.goals) {
    for (const g of data.goals) {
      if (!g.active) continue;
      const accumulated = (g.startAmountCents ?? 0) + (allContributions.get(g.id) ?? 0);
      goalProgress.push({
        goalId: g.id,
        goalName: g.name,
        targetAmountCents: g.targetAmountCents,
        accumulatedCents: accumulated,
      });
      if (!contributionThisMonth.has(g.id)) {
        pendingContributions.push({ goalId: g.id, goalName: g.name });
      }
    }
  }

  if (data.activeTemplateIds) {
    const snapIds = new Set(data.expenseSnapshots.map(s => s.expenseId));
    for (const tid of data.activeTemplateIds) {
      if (!snapIds.has(tid)) {
        pendingExpenses.push({ expenseId: tid, expenseName: tid });
      }
    }
  }

  for (const snap of data.expenseSnapshots) {
    const ordered = [...snap.participants].sort(
      (a, b) =>
        (memberOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (memberOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );

    let shares: Array<[string, number]>;
    if (snap.splitRule.method === "proportional") {
      const totalSpendable = snap.participants.reduce((s, p) => s + (spendable.get(p) ?? 0), 0);
      if (totalSpendable === 0) {
        shares = splitEvenly(snap.amountCents, ordered);
      } else {
        shares = splitProportional(snap.amountCents, snap.participants, spendable, memberOrder);
      }
    } else if (snap.splitRule.method === "custom") {
      if (snap.splitRule.mode === "amount") {
        shares = snap.participants.map((mid) => [mid, snap.splitRule.values[mid] ?? 0] as [string, number]);
      } else {
        shares = splitProportional(snap.amountCents, snap.participants, new Map(snap.participants.map(p => [p, snap.splitRule.values[p] ?? 0])), memberOrder);
      }
    } else {
      shares = splitEvenly(snap.amountCents, ordered);
    }

    for (const [memberId, amountCents] of shares) {
      sharesByMember.get(memberId)?.push({
        expenseId: snap.expenseId,
        expenseName: snap.name,
        amountCents,
      });
    }
  }

  const members: MemberSummary[] = data.members.map((m) => {
    const shares = sharesByMember.get(m.id) ?? [];
    const totalCents = shares.reduce((s, sh) => s + sh.amountCents, 0);
    const income = incomeByMember.get(m.id) ?? 0;
    const contribs = contributionByMember.get(m.id) ?? 0;
    return {
      memberId: m.id,
      name: m.name,
      incomeCents: income,
      shares,
      totalCents,
      leftoverCents: (spendable.get(m.id) ?? 0) - totalCents - contribs,
    };
  });

  return { month: data.month, currency: data.currency, members, pendingExpenses, goalProgress, pendingContributions };
}

function splitEvenly(amountCents: number, participants: string[]): Array<[string, number]> {
  const count = participants.length;
  const base = Math.floor(amountCents / count);
  const remainder = amountCents - base * count;
  return participants.map((memberId, i) => [memberId, i < remainder ? base + 1 : base]);
}

function splitProportional(
  amountCents: number,
  participants: string[],
  weights: Map<string, number>,
  memberOrder: Map<string, number>,
): Array<[string, number]> {
  const totalWeight = participants.reduce((s, p) => s + (weights.get(p) ?? 0), 0);
  if (totalWeight === 0) return splitEvenly(amountCents, participants);

  const exact = participants.map((p) => ({
    memberId: p,
    exact: (amountCents * (weights.get(p) ?? 0)) / totalWeight,
  }));

  const floored = exact.map((e) => ({
    memberId: e.memberId,
    amount: Math.floor(e.exact),
    remainder: e.exact - Math.floor(e.exact),
  }));

  let distributed = floored.reduce((s, f) => s + f.amount, 0);
  let remaining = amountCents - distributed;

  const sorted = [...floored].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    const oa = memberOrder.get(a.memberId) ?? Number.MAX_SAFE_INTEGER;
    const ob = memberOrder.get(b.memberId) ?? Number.MAX_SAFE_INTEGER;
    return oa - ob;
  });

  for (let i = 0; i < remaining; i++) sorted[i]!.amount++;
  return sorted.map((s) => [s.memberId, s.amount]);
}

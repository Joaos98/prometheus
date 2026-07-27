import type {
  FallbackExpense,
  Household,
  IncomeSource,
  MemberSummary,
  Month,
  MonthlySummary,
  PendingExpense,
  Share,
} from "./types.js";

export function computeMonthlySummary(
  household: Household,
  month: Month,
): MonthlySummary {
  const activeExpenses = household.expenses.filter(
    (e) =>
      e.effectiveFrom <= month &&
      (e.endedFrom === undefined || e.endedFrom > month),
  );

  const memberOrder = new Map<string, number>(
    household.members.map((member, index) => [member.id, index]),
  );

  const incomeByMember = computeIncomeByMember(
    household.incomeSources,
    month,
  );

  const sharesByMember = new Map<string, Share[]>();
  for (const member of household.members) {
    sharesByMember.set(member.id, []);
  }

  const pending: PendingExpense[] = [];
  const fallback: FallbackExpense[] = [];

  for (const expense of activeExpenses) {
    const amount = household.expenseAmounts.find(
      (a) => a.expenseId === expense.id && a.month === month,
    );
    if (!amount) {
      pending.push({ expenseId: expense.id, expenseName: expense.name });
      continue;
    }

    const orderedParticipants = [...expense.participants].sort(
      (a, b) =>
        (memberOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (memberOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );

    let shares: Array<[string, number]>;
    if (expense.splitRule.method === "proportional") {
      shares = computeProportionalShares(
        amount.amountCents,
        expense,
        incomeByMember,
        memberOrder,
        fallback,
      );
    } else {
      shares = splitEvenly(amount.amountCents, orderedParticipants);
    }

    for (const [memberId, amountCents] of shares) {
      sharesByMember.get(memberId)?.push({
        expenseId: expense.id,
        expenseName: expense.name,
        amountCents,
      });
    }
  }

  const members: MemberSummary[] = household.members.map((member) => {
    const shares = sharesByMember.get(member.id) ?? [];
    const totalCents = shares.reduce((sum, s) => sum + s.amountCents, 0);
    const memberIncome = incomeByMember.get(member.id) ?? 0;
    return {
      memberId: member.id,
      name: member.name,
      incomeCents: memberIncome,
      shares,
      totalCents,
      leftoverCents: memberIncome - totalCents,
    };
  });

  return {
    month,
    currency: household.currency,
    members,
    pendingExpenses: pending,
    fallbackExpenses: fallback,
  };
}

function computeIncomeByMember(
  sources: IncomeSource[],
  month: Month,
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const source of sources) {
    if (source.endedFrom !== undefined && source.endedFrom <= month) continue;

    let latestEntry = source.timeline[0];
    if (!latestEntry) continue;

    for (const entry of source.timeline) {
      if (entry.effectiveFrom <= month) {
        latestEntry = entry;
      }
    }

    const existing = totals.get(source.memberId) ?? 0;
    totals.set(source.memberId, existing + latestEntry.amountCents);
  }

  return totals;
}

function computeProportionalShares(
  amountCents: number,
  expense: { id: string; name: string; participants: string[] },
  incomes: Map<string, number>,
  memberOrder: Map<string, number>,
  fallback: FallbackExpense[],
): Array<[string, number]> {
  const totalIncome = expense.participants.reduce(
    (sum, p) => sum + (incomes.get(p) ?? 0),
    0,
  );

  if (totalIncome === 0) {
    fallback.push({ expenseId: expense.id, expenseName: expense.name });
    const ordered = [...expense.participants].sort(
      (a, b) =>
        (memberOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (memberOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
    return splitEvenly(amountCents, ordered);
  }

  const exact = expense.participants.map((p) => ({
    memberId: p,
    exact: (amountCents * (incomes.get(p) ?? 0)) / totalIncome,
  }));

  const floored = exact.map((e) => ({
    memberId: e.memberId,
    amount: Math.floor(e.exact),
    remainder: e.exact - Math.floor(e.exact),
  }));

  let distributed = 0;
  for (const f of floored) distributed += f.amount;
  let remaining = amountCents - distributed;

  const sorted = [...floored].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    const orderA = memberOrder.get(a.memberId) ?? Number.MAX_SAFE_INTEGER;
    const orderB = memberOrder.get(b.memberId) ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

  for (let i = 0; i < remaining; i++) {
    sorted[i]!.amount++;
  }

  return sorted.map((s) => [s.memberId, s.amount]);
}

/**
 * Divides an amount into integer-cent Shares, one per participant, using
 * largest-remainder apportionment: leftover cents go one each to the first
 * participants in household member order (participants are pre-sorted by the
 * caller). Shares always sum exactly to the total, and identical inputs
 * always produce identical outputs.
 */
function splitEvenly(
  amountCents: number,
  participants: string[],
): Array<[string, number]> {
  const count = participants.length;
  const base = Math.floor(amountCents / count);
  const remainder = amountCents - base * count;
  return participants.map((memberId, index) => [
    memberId,
    index < remainder ? base + 1 : base,
  ]);
}

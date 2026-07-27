import type {
  Household,
  IncomeSource,
  MemberSummary,
  Month,
  MonthlySummary,
  Share,
} from "./types.js";

export function computeMonthlySummary(
  household: Household,
  month: Month,
): MonthlySummary {
  const activeExpenses = household.expenses.filter(
    (e) => e.effectiveFrom <= month,
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

  for (const expense of activeExpenses) {
    const amount = household.expenseAmounts.find(
      (a) => a.expenseId === expense.id && a.month === month,
    );
    if (!amount) continue;

    const orderedParticipants = [...expense.participants].sort(
      (a, b) =>
        (memberOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (memberOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
    const shares = splitEvenly(amount.amountCents, orderedParticipants);
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
    return {
      memberId: member.id,
      name: member.name,
      incomeCents: incomeByMember.get(member.id) ?? 0,
      shares,
      totalCents: shares.reduce((sum, s) => sum + s.amountCents, 0),
    };
  });

  return { month, currency: household.currency, members };
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

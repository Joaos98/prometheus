import type {
  Expense,
  Household,
  MemberSummary,
  MonthlySummary,
  Share,
} from "./types.js";

export function computeMonthlySummary(
  household: Household,
  month: string,
): MonthlySummary {
  const activeExpenses = household.expenses.filter(
    (e) => e.effectiveFrom <= month,
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

    const shares = splitEvenly(amount.amountCents, expense.participants);
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
      shares,
      totalCents: shares.reduce((sum, s) => sum + s.amountCents, 0),
    };
  });

  return { month, currency: household.currency, members };
}

/**
 * Divides an amount into integer-cent Shares, one per participant, using
 * largest-remainder apportionment: leftover cents go one each to the first
 * participants in household member order. Shares always sum exactly to the
 * total, and identical inputs always produce identical outputs.
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

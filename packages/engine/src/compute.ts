import type { MemberSummary, MonthData, MonthlySummary, Share } from "./types.js";

export function computeMonthlySummary(data: MonthData): MonthlySummary {
  const memberOrder = new Map<string, number>(
    data.members.map((m, i) => [m.id, i]),
  );

  const incomeByMember = new Map<string, number>();
  for (const snap of data.incomeSnapshots) {
    const prev = incomeByMember.get(snap.memberId) ?? 0;
    incomeByMember.set(snap.memberId, prev + snap.amountCents);
  }

  const sharesByMember = new Map<string, Share[]>();
  for (const m of data.members) sharesByMember.set(m.id, []);

  for (const snap of data.expenseSnapshots) {
    const ordered = [...snap.participants].sort(
      (a, b) =>
        (memberOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (memberOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
    const shares = splitEvenly(snap.amountCents, ordered);
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
    return {
      memberId: m.id,
      name: m.name,
      incomeCents: income,
      shares,
      totalCents,
      leftoverCents: income - totalCents,
    };
  });

  return { month: data.month, currency: data.currency, members };
}

function splitEvenly(
  amountCents: number,
  participants: string[],
): Array<[string, number]> {
  const count = participants.length;
  const base = Math.floor(amountCents / count);
  const remainder = amountCents - base * count;
  return participants.map((memberId, i) => [
    memberId,
    i < remainder ? base + 1 : base,
  ]);
}

import type {
  GoalProgress,
  Household,
  IncomeSource,
  MemberSummary,
  Month,
  MonthlySummary,
  PendingItem,
  SavingsGoal,
  Share,
} from "./types.js";

export function computeMonthlySummary(
  household: Household,
  month: Month,
): MonthlySummary {
  const activeMembers = household.members.filter(
    (m) =>
      (m.joinedFrom === undefined || m.joinedFrom <= month) &&
      (m.departedFrom === undefined || m.departedFrom > month),
  );

  const memberOrder = new Map<string, number>(
    activeMembers.map((member, index) => [member.id, index]),
  );

  const { total: totalIncome, restricted: restrictedIncome } =
    computeIncomeByMember(household.incomeSources, month);

  const sharesByMember = new Map<string, Share[]>();
  for (const member of activeMembers) {
    sharesByMember.set(member.id, []);
  }

  const pendingExpenses: PendingItem[] = [];
  const fallbackExpenses: PendingItem[] = [];

  for (const item of activeItems(
    household.expenses,
    month,
  )) {
    const amount = household.expenseAmounts.find(
      (a) => a.expenseId === item.id && a.month === month,
    );
    if (!amount) {
      pendingExpenses.push({ itemId: item.id, itemName: item.name });
      continue;
    }

    const ordered = [...item.participants].sort(
      (a, b) =>
        (memberOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (memberOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );

    let shares: Array<[string, number]>;
    if (item.splitRule.method === "proportional") {
      shares = computeProportionalShares(
        amount.amountCents,
        item.id,
        item.name,
        item.participants,
        totalIncome,
        restrictedIncome,
        memberOrder,
        fallbackExpenses,
      );
    } else if (item.splitRule.method === "custom") {
      shares = computeCustomShares(
        amount.amountCents,
        item.participants,
        item.splitRule,
        memberOrder,
      );
    } else {
      shares = splitEvenly(amount.amountCents, ordered);
    }

    for (const [memberId, amountCents] of shares) {
      sharesByMember.get(memberId)?.push({
        expenseId: item.id,
        expenseName: item.name,
        amountCents,
      });
    }
  }

  const contributionByMember = new Map<string, number>();
  for (const member of activeMembers) {
    contributionByMember.set(member.id, 0);
  }

  const pendingContributions: PendingItem[] = [];
  const fallbackContributions: PendingItem[] = [];

  for (const item of activeItems(
    household.goals,
    month,
  )) {
    const amount = household.goalContributions.find(
      (a) => a.goalId === item.id && a.month === month,
    );
    if (!amount) {
      pendingContributions.push({ itemId: item.id, itemName: item.name });
      continue;
    }

    const ordered = [...item.participants].sort(
      (a, b) =>
        (memberOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (memberOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );

    let shares: Array<[string, number]>;
    if (item.splitRule.method === "proportional") {
      shares = computeProportionalShares(
        amount.amountCents,
        item.id,
        item.name,
        item.participants,
        totalIncome,
        restrictedIncome,
        memberOrder,
        fallbackContributions,
      );
    } else if (item.splitRule.method === "custom") {
      shares = computeCustomShares(
        amount.amountCents,
        item.participants,
        item.splitRule,
        memberOrder,
      );
    } else {
      shares = splitEvenly(amount.amountCents, ordered);
    }

    for (const [memberId, amountCents] of shares) {
      contributionByMember.set(
        memberId,
        (contributionByMember.get(memberId) ?? 0) + amountCents,
      );
    }
  }

  const goalProgress: GoalProgress[] = household.goals.map((g) => {
    const contributionSum = household.goalContributions
      .filter((c) => c.goalId === g.id)
      .reduce((sum, c) => sum + c.amountCents, 0);
    const accumulated = (g.startAmountCents ?? 0) + contributionSum;
    const progress: GoalProgress = {
      goalId: g.id,
      goalName: g.name,
      accumulatedCents: accumulated,
    };
    if (g.targetAmountCents !== undefined) {
      progress.targetAmountCents = g.targetAmountCents;
    }
    return progress;
  });

  const members: MemberSummary[] = activeMembers.map((member) => {
    const shares = sharesByMember.get(member.id) ?? [];
    const totalCents = shares.reduce((sum, s) => sum + s.amountCents, 0);
    const income = totalIncome.get(member.id) ?? 0;
    const restricted = restrictedIncome.get(member.id) ?? 0;
    const contributions = contributionByMember.get(member.id) ?? 0;
    return {
      memberId: member.id,
      name: member.name,
      incomeCents: income,
      restrictedCents: restricted,
      shares,
      totalCents,
      contributionCents: contributions,
      leftoverCents: income - restricted - totalCents - contributions,
    };
  });

  return {
    month,
    currency: household.currency,
    members,
    goalProgress,
    pendingExpenses,
    pendingContributions,
    fallbackExpenses,
    fallbackContributions,
  };
}

/** Filters items to those active in the given month. */
function activeItems<
  T extends {
    id: string;
    name: string;
    effectiveFrom: string;
    endedFrom?: string;
  },
>(items: T[], month: Month): T[] {
  return items.filter(
    (item) =>
      item.effectiveFrom <= month &&
      (item.endedFrom === undefined || item.endedFrom > month),
  );
}

function computeIncomeByMember(
  sources: IncomeSource[],
  month: Month,
): { total: Map<string, number>; restricted: Map<string, number> } {
  const total = new Map<string, number>();
  const restricted = new Map<string, number>();

  for (const source of sources) {
    if (source.endedFrom !== undefined && source.endedFrom <= month) continue;

    let latestEntry = undefined as
      | { amountCents: number; effectiveFrom: string }
      | undefined;
    for (const entry of source.timeline) {
      if (entry.effectiveFrom <= month) {
        latestEntry = entry;
      }
    }
    if (!latestEntry) continue;

    const existingTotal = total.get(source.memberId) ?? 0;
    total.set(source.memberId, existingTotal + latestEntry.amountCents);

    if (source.restrictedUse) {
      const existingRestricted = restricted.get(source.memberId) ?? 0;
      restricted.set(
        source.memberId,
        existingRestricted + latestEntry.amountCents,
      );
    }
  }

  return { total, restricted };
}

function computeProportionalShares(
  amountCents: number,
  id: string,
  name: string,
  participants: string[],
  totalIncome: Map<string, number>,
  restrictedIncome: Map<string, number>,
  memberOrder: Map<string, number>,
  fallback: PendingItem[],
): Array<[string, number]> {
  const spendable = new Map<string, number>();
  for (const p of participants) {
    spendable.set(
      p,
      (totalIncome.get(p) ?? 0) - (restrictedIncome.get(p) ?? 0),
    );
  }

  const totalSpendable = participants.reduce(
    (sum, p) => sum + (spendable.get(p) ?? 0),
    0,
  );

  if (totalSpendable === 0) {
    fallback.push({ itemId: id, itemName: name });
    const ordered = [...participants].sort(
      (a, b) =>
        (memberOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (memberOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
    return splitEvenly(amountCents, ordered);
  }

  const exact = participants.map((p) => ({
    memberId: p,
    exact: (amountCents * (spendable.get(p) ?? 0)) / totalSpendable,
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

function computeCustomShares(
  amountCents: number,
  participants: string[],
  splitRule: { mode: "percent" | "amount"; values: Record<string, number> },
  memberOrder: Map<string, number>,
): Array<[string, number]> {
  const { mode, values } = splitRule;

  if (mode === "amount") {
    return participants.map(
      (memberId) => [memberId, values[memberId] ?? 0] as [string, number],
    );
  }

  const exact = participants.map((memberId) => ({
    memberId,
    exact: (amountCents * (values[memberId] ?? 0)) / 100,
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

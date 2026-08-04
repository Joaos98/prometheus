/**
 * Carrying a Household out of Prometheus and back in: a backup a self-hoster can take
 * without touching a Docker volume, and the way out of the demo for somebody who has
 * been trying it and wants to keep what they entered.
 *
 * Both directions are pure. Export is a serialisation of the Household as it stands, and
 * import returns the Household a file describes without touching anything — so a file
 * that fails to read leaves the current Household exactly where it was, and there is no
 * such thing here as a half-finished migration.
 *
 * Nothing but Household data travels. The Viewer and its display toggles are the device's
 * own and are not in the file, because they are not the Household's to carry.
 */
import { DomainError } from './errors.js'
import { totalOfLines } from './expenses.js'
import { requireCurrency } from './household.js'
import { assertMonthKey } from './month-key.js'
import { entryCount, openedMonthKeys } from './month.js'
import { requireAmount } from './rows.js'
import { requireConsistentRule } from './split-rules.js'
import type {
  Currency,
  ExpenseSnapshot,
  Household,
  IncomeSnapshot,
  LineItem,
  Member,
  MemberId,
  Minor,
  Month,
  MonthKey,
  SavingsGoal,
  SplitRule,
} from './types.js'

/** What every export says it is, so a file that is not one of ours is refused as such. */
const MARKER = 'prometheus.household'

/**
 * The shape of the file. A Household written by a later Prometheus may hold things this
 * one has no idea what to do with, so a higher number is refused rather than guessed at.
 */
export const HOUSEHOLD_FILE_FORMAT = 1

/** What an import is about to replace, said before it replaces it. */
export interface Replacement {
  months: number
  entries: number
  members: number
  earliest: MonthKey | undefined
  latest: MonthKey | undefined
}

/** The whole Household as one JSON file: its currency, its Roster and every opened Month. */
export function exportHousehold(household: Household): string {
  const months: Record<MonthKey, Month> = {}
  for (const key of openedMonthKeys(household)) months[key] = household.months[key]!

  return `${JSON.stringify(
    {
      prometheus: MARKER,
      format: HOUSEHOLD_FILE_FORMAT,
      currency: household.currency,
      roster: household.roster,
      months,
    },
    null,
    2,
  )}\n`
}

/**
 * The Household a file describes, or nothing at all.
 *
 * Every field is read out and checked rather than trusted, and the Household is built
 * afresh from what was read — so a file that is a Household in part is not imported in
 * part. The same rules the engine enforces on a member's own edits are enforced here: an
 * Expense divides among members of its Month, a Split Rule totals what it must, and an
 * amount is a whole number of minor units or nothing at all.
 */
export function importHousehold(text: string): Household {
  const file = fileOf(text)
  const currency = readCurrency(file.currency)
  const roster = readRoster(file.roster)
  const months = readMonths(file.months, roster, currency)
  return { currency, roster, months }
}

/**
 * What importing would replace, so that restoring a backup cannot quietly destroy the
 * Household somebody is using. Said of the Household as it stands, never of the file.
 */
export function whatImportReplaces(household: Household): Replacement {
  const opened = openedMonthKeys(household)
  return {
    months: opened.length,
    entries: opened.reduce((total, key) => total + entryCount(household.months[key]!), 0),
    members: household.roster.length,
    earliest: opened.at(0),
    latest: opened.at(-1),
  }
}

function fileOf(text: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return reject('it is not JSON')
  }

  const file = readObject(parsed, 'The file')
  if (file.prometheus !== MARKER) reject('it was not written by Prometheus')

  const format = readWhole(file.format, "The file's format")
  if (format > HOUSEHOLD_FILE_FORMAT) {
    reject(
      `it was written in format ${format}, and this Prometheus reads up to ${HOUSEHOLD_FILE_FORMAT} — a newer Prometheus will read it`,
    )
  }
  return file
}

function readCurrency(value: unknown): Currency {
  const currency = readObject(value, 'The currency')
  const read: Currency = {
    code: readText(currency.code, "The currency's code"),
    symbol: typeof currency.symbol === 'string' ? currency.symbol : '',
    decimals: readWhole(currency.decimals, "The currency's decimal places"),
  }
  try {
    return requireCurrency(read)
  } catch (cause) {
    return reject(cause instanceof DomainError ? lowered(cause.message) : String(cause))
  }
}

function readRoster(value: unknown): Member[] {
  const roster = readArray(value, 'The Roster').map((entry) => {
    const member = readObject(entry, 'A member of the Roster')
    return {
      id: readText(member.id, "A Roster member's identity"),
      name: readText(member.name, "A Roster member's name"),
      active: readFlag(member.active, 'Whether a Roster member is active'),
    }
  })
  requireDistinct(
    roster.map((member) => member.id),
    'Two people on the Roster share an identity',
  )
  return roster
}

function readMonths(value: unknown, roster: Member[], currency: Currency): Record<MonthKey, Month> {
  const months: Record<MonthKey, Month> = {}
  for (const [key, month] of Object.entries(readObject(value, 'The Months'))) {
    const at = monthKeyOf(key)
    months[at] = readMonth(month, at, roster, currency)
  }
  return months
}

function readMonth(value: unknown, key: MonthKey, roster: Member[], currency: Currency): Month {
  const month = readObject(value, `${key}`)
  if (month.key !== key) reject(`${key} is filed under a key it does not carry`)

  const onRoster = new Set(roster.map((member) => member.id))
  const members = readArray(month.members, `${key}'s members`).map((member) => {
    const id = readText(member, `A member of ${key}`)
    if (!onRoster.has(id)) reject(`${key} holds somebody who is not on the Roster`)
    return id
  })
  requireDistinct(members, `${key} names the same member twice`)

  const income = readArray(month.income, `${key}'s income`).map((row) =>
    readIncome(row, key, members),
  )
  const expenses = readArray(month.expenses, `${key}'s Expenses`).map((row) =>
    readExpense(row, key, members, currency),
  )
  const goals = readArray(month.goals, `${key}'s Savings Goals`).map((row) =>
    readGoal(row, key, members),
  )

  for (const rows of [income, expenses, goals]) {
    requireDistinct(
      rows.map((row) => row.id),
      `${key} holds two rows of the same identity`,
    )
  }

  return { key, members, income, expenses, goals }
}

function readIncome(value: unknown, key: MonthKey, members: MemberId[]): IncomeSnapshot {
  const row = readObject(value, `An income row of ${key}`)
  const named = readText(row.name, `The name of an income row of ${key}`)
  const member = readText(row.member, `The member of ${key}'s "${named}"`)
  if (!members.includes(member)) {
    reject(`${key}'s "${named}" belongs to somebody who is not a member of that Month`)
  }

  return {
    id: readText(row.id, `The identity of ${key}'s "${named}"`),
    name: named,
    member,
    amount: readAmount(row, `${key}'s "${named}"`),
    restrictedUse: readFlag(row.restrictedUse, `Whether ${key}'s "${named}" is Restricted-Use`),
    reviewed: readFlag(row.reviewed, `Whether ${key}'s "${named}" has been reviewed`),
    oneOff: readFlag(row.oneOff, `Whether ${key}'s "${named}" is One-Off`),
  }
}

function readExpense(
  value: unknown,
  key: MonthKey,
  members: MemberId[],
  currency: Currency,
): ExpenseSnapshot {
  const row = readObject(value, `An Expense of ${key}`)
  const named = readText(row.name, `The name of an Expense of ${key}`)
  const lines = readLines(row.lines, key, named)
  /**
   * A composite's amount is recomputed from its lines rather than trusted from the file,
   * exactly as `consistent` recomputes it on every write the engine makes — a hand-edited
   * or stale total in the file could otherwise disagree with the lines beside it, which is
   * the one thing the engine's own invariant never allows.
   */
  const amount =
    lines.length > 0
      ? requireAmount(totalOfLines(lines))
      : readAmount(row, `${key}'s "${named}"`)
  const participants = readParticipants(row.participants, key, named, members)
  const splitRule = readSplitRule(row.splitRule, key, named)

  try {
    requireConsistentRule(splitRule, amount, participants, currency)
  } catch (cause) {
    reject(
      cause instanceof DomainError
        ? `${key}'s "${named}" does not add up — ${lowered(cause.message)}`
        : String(cause),
    )
  }

  return {
    id: readText(row.id, `The identity of ${key}'s "${named}"`),
    name: named,
    category: typeof row.category === 'string' ? row.category : '',
    amount,
    lines,
    participants,
    splitRule,
    reviewed: readFlag(row.reviewed, `Whether ${key}'s "${named}" has been reviewed`),
    oneOff: readFlag(row.oneOff, `Whether ${key}'s "${named}" is One-Off`),
  }
}

/** A v1.2 file has no `lines` key at all, which reads as the simple Expense it is. */
function readLines(value: unknown, key: MonthKey, named: string): LineItem[] {
  if (value === undefined) return []
  const lines = readArray(value, `The lines of ${key}'s "${named}"`).map((entry) =>
    readLine(entry, key, named),
  )
  requireDistinct(
    lines.map((line) => line.id),
    `${key}'s "${named}" holds two Line Items of the same identity`,
  )
  return lines
}

function readLine(value: unknown, key: MonthKey, named: string): LineItem {
  const row = readObject(value, `A Line Item of ${key}'s "${named}"`)
  const subject = `A Line Item of ${key}'s "${named}"`
  return {
    id: readText(row.id, `The identity of ${subject}`),
    name: readText(row.name, `The name of ${subject}`),
    amount: readAmount(row, subject),
  }
}

function readGoal(value: unknown, key: MonthKey, members: MemberId[]): SavingsGoal {
  const row = readObject(value, `A Savings Goal of ${key}`)
  const named = readText(row.name, `The name of a Savings Goal of ${key}`)
  const participants = readParticipants(row.participants, key, named, members)

  const contributions: Record<MemberId, Minor> = Object.fromEntries(
    Object.entries(readObject(row.contributions, `The Contributions to ${key}'s "${named}"`)).map(
      ([member, amount]): [MemberId, Minor] => {
        if (!participants.includes(member)) {
          reject(`${key}'s "${named}" holds a Contribution from somebody not saving for it`)
        }
        return [member, readSaved(amount, `A Contribution to ${key}'s "${named}"`)]
      },
    ),
  )

  return {
    id: readText(row.id, `The identity of ${key}'s "${named}"`),
    name: named,
    target: row.target === null ? null : readSaved(row.target, `The target of ${key}'s "${named}"`),
    startAmount: readSaved(row.startAmount, `The start amount of ${key}'s "${named}"`),
    participants,
    contributions,
    reviewed: readFlag(row.reviewed, `Whether ${key}'s "${named}" has been reviewed`),
    oneOff: readFlag(row.oneOff, `Whether ${key}'s "${named}" is One-Off`),
  }
}

/**
 * A row's Participants, in the Month's own member order — the order Shares are computed
 * in, so that a file listing them any other way still renders the Month it described.
 */
function readParticipants(
  value: unknown,
  key: MonthKey,
  named: string,
  members: MemberId[],
): MemberId[] {
  const participants = readArray(value, `The Participants of ${key}'s "${named}"`).map(
    (participant) => readText(participant, `A Participant of ${key}'s "${named}"`),
  )
  for (const participant of participants) {
    if (!members.includes(participant)) {
      reject(`${key}'s "${named}" names a Participant who is not a member of that Month`)
    }
  }
  requireDistinct(participants, `${key}'s "${named}" names the same Participant twice`)
  if (participants.length === 0) reject(`${key}'s "${named}" names nobody`)

  return members.filter((member) => participants.includes(member))
}

function readSplitRule(value: unknown, key: MonthKey, named: string): SplitRule {
  const rule = readObject(value, `The Split Rule of ${key}'s "${named}"`)
  const subject = `The Split Rule of ${key}'s "${named}"`

  switch (rule.kind) {
    case 'even':
      return { kind: 'even' }
    case 'proportional':
      return { kind: 'proportional' }
    case 'percentage':
      return {
        kind: 'percentage',
        byMember: readByMember(rule.byMember, subject, (share, whose) =>
          readNumber(share, whose),
        ),
      }
    case 'fixed':
      return {
        kind: 'fixed',
        byMember: readByMember(rule.byMember, subject, (share, whose) => readWhole(share, whose)),
      }
    default:
      return reject(`${lowered(subject)} is not a rule Prometheus knows`)
  }
}

function readByMember<Value>(
  value: unknown,
  subject: string,
  read: (share: unknown, whose: string) => Value,
): Record<MemberId, Value> {
  return Object.fromEntries(
    Object.entries(readObject(value, subject)).map(([member, share]) => [
      member,
      read(share, `A share named by ${lowered(subject)}`),
    ]),
  )
}

/**
 * An amount, which a row must carry even when it carries nothing: `null` is Pending — no
 * amount entered at all — and that is a different thing from a field that is not there,
 * which is a file this Prometheus cannot vouch for either way.
 */
function readAmount(row: Record<string, unknown>, subject: string): Minor | null {
  if (!('amount' in row)) reject(`${subject} has no amount field at all`)
  return row.amount === null ? null : readWhole(row.amount, `The amount of ${subject}`)
}

/** Every figure on a Savings Goal is money saved, so none of them is ever negative. */
function readSaved(value: unknown, subject: string): Minor {
  const amount = readWhole(value, subject)
  if (amount < 0) reject(`${lowered(subject)} is negative`)
  return amount
}

function readObject(value: unknown, subject: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    reject(`${lowered(subject)} is missing or is not what it should be`)
  }
  return value as Record<string, unknown>
}

function readArray(value: unknown, subject: string): unknown[] {
  if (!Array.isArray(value)) reject(`${lowered(subject)} is missing or is not a list`)
  return value
}

function readText(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim() === '') reject(`${lowered(subject)} is missing`)
  return value
}

function readFlag(value: unknown, subject: string): boolean {
  if (typeof value !== 'boolean') reject(`${lowered(subject)} is missing`)
  return value
}

function readNumber(value: unknown, subject: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    reject(`${lowered(subject)} is not a number`)
  }
  return value
}

function readWhole(value: unknown, subject: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    reject(`${lowered(subject)} is not a whole number`)
  }
  return value
}

function requireDistinct(values: string[], complaint: string): void {
  if (new Set(values).size !== values.length) reject(lowered(complaint))
}

function monthKeyOf(key: string): MonthKey {
  try {
    return assertMonthKey(key)
  } catch {
    return reject(`"${key}" is filed as a Month and is not one`)
  }
}

function reject(what: string): never {
  throw new DomainError(`This file is not a Household Prometheus can read: ${what}`)
}

/** A complaint written as a sentence, read back as a clause of a longer one. */
function lowered(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1)
}

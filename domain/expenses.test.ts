import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from './errors.js'
import {
  addExpenseSnapshot,
  addLineItem,
  editExpenseSnapshot,
  editLineItem,
  itemiseExpense,
  setExpenseOneOff,
  removeExpenseSnapshot,
  removeLineItem,
  totalOfLines,
} from './expenses.js'
import { setUpHousehold } from './household.js'
import { monthAt, openMonth } from './month.js'
import { isComposite, isOneOff, isPending } from './rows.js'
import { isReviewed } from './review.js'
import type { Household, MemberId, Minor } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
let ana: MemberId
let bruno: MemberId
let cleo: MemberId

beforeEach(() => {
  household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana', 'Bruno', 'Cleo'],
    startingMonth: '2026-07',
  })
  ;[ana, bruno, cleo] = household.roster.map((member) => member.id) as [
    MemberId,
    MemberId,
    MemberId,
  ]
})

const expensesIn = (of: Household, month = '2026-07') => monthAt(of, month)!.expenses

/** An Expense recorded as a single typed figure, which is every Expense until itemised. */
const groceries = (amount: Minor | null = 30000) =>
  addExpenseSnapshot(household, '2026-07', {
    name: 'Groceries',
    category: 'Home',
    amount,
    participants: [ana, bruno],
  })

/** The same, split by a rule that only ever totals to one amount. */
const fixedGroceries = () =>
  addExpenseSnapshot(household, '2026-07', {
    name: 'Groceries',
    category: 'Home',
    amount: 30000,
    participants: [ana, bruno],
    splitRule: { kind: 'fixed', byMember: { [ana]: 20000, [bruno]: 10000 } },
  })

/** A composite built line by line, so its amount was never a figure anybody typed. */
const itemisedGroceries = () => {
  const { household: after, row } = groceries(null)
  const fruit = addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })
  return addLineItem(fruit.household, '2026-07', row.id, { name: 'Meat', amount: 1800 })
}

describe('recording an Expense', () => {
  it('records a name, a category, an amount, its Participants and its Split Rule', () => {
    const { row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    })

    expect(row).toEqual({
      id: expect.any(String),
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      lines: [],
      participants: [ana, bruno],
      splitRule: { kind: 'even' },
      reviewed: true,
      oneOff: false,
    })
    expect(isComposite(row)).toBe(false)
  })

  it('mints a stable identity when the Expense first appears', () => {
    const first = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: null,
      amount: 1,
      participants: [ana],
    })
    const second = addExpenseSnapshot(first.household, '2026-07', {
      name: 'Rent',
      category: null,
      amount: 1,
      participants: [ana],
    })

    expect(second.row.id).not.toBe(first.row.id)
  })

  it('divides evenly unless it is told otherwise', () => {
    const { row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Groceries',
      category: 'Home',
      amount: 30000,
      participants: [ana, bruno],
    })

    expect(row.splitRule).toEqual({ kind: 'even' })
  })

  it('divides among a single Participant, which is how an individual cost is recorded', () => {
    const { row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Gym',
      category: 'Health',
      amount: 4000,
      participants: [bruno],
    })

    expect(row.participants).toEqual([bruno])
  })

  it('may be recorded without a category', () => {
    const { row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Odds and ends',
      category: null,
      amount: 1200,
      participants: [ana],
    })

    expect(row.category).toBe(null)
  })

  it('needs a name', () => {
    expect(() =>
      addExpenseSnapshot(household, '2026-07', {
        name: '   ',
        category: '',
        amount: 1200,
        participants: [ana],
      }),
    ).toThrow(DomainError)
  })

  it('needs somebody to divide among', () => {
    expect(() =>
      addExpenseSnapshot(household, '2026-07', {
        name: 'Rent',
        category: 'Home',
        amount: 120000,
        participants: [],
      }),
    ).toThrow(DomainError)
  })

  it('divides only among members of that Month', () => {
    expect(() =>
      addExpenseSnapshot(household, '2026-07', {
        name: 'Rent',
        category: 'Home',
        amount: 120000,
        participants: [ana, 'somebody-else'],
      }),
    ).toThrow(DomainError)
  })

  it('lists each Participant once, in the Month’s member order', () => {
    const { row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [cleo, ana, cleo],
    })

    expect(row.participants).toEqual([ana, cleo])
  })

  it('cannot be recorded on a Month that has not been opened', () => {
    expect(() =>
      addExpenseSnapshot(household, '2026-08', {
        name: 'Rent',
        category: 'Home',
        amount: 120000,
        participants: [ana],
      }),
    ).toThrow(DomainError)
  })

  it('leaves the Household it was given untouched', () => {
    addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana],
    })

    expect(expensesIn(household)).toEqual([])
  })
})

describe('an Expense amount', () => {
  it('may be nothing at all — an Expense’s first Month has nothing to inherit', () => {
    const { row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Water',
      category: 'Home',
      amount: null,
      participants: [ana, bruno],
    })

    expect(row.amount).toBeNull()
    expect(isPending(row)).toBe(true)
  })

  it('may be an explicit zero, which says this cost nothing this Month', () => {
    const { row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Water',
      category: 'Home',
      amount: 0,
      participants: [ana, bruno],
    })

    expect(row.amount).toBe(0)
    expect(isPending(row)).toBe(false)
  })

  it('refuses anything that is not whole minor units', () => {
    expect(() =>
      addExpenseSnapshot(household, '2026-07', {
        name: 'Water',
        category: 'Home',
        amount: 12.5,
        participants: [ana],
      }),
    ).toThrow(DomainError)
  })
})

describe('editing an Expense', () => {
  const rent = () =>
    addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    })

  it('changes the amount of the row it names', () => {
    const { household: after, row } = rent()

    const edited = editExpenseSnapshot(after, '2026-07', row.id, { amount: 125000 })

    expect(edited.row.amount).toBe(125000)
  })

  it('leaves the fields it does not name alone', () => {
    const { household: after, row } = rent()

    const edited = editExpenseSnapshot(after, '2026-07', row.id, { amount: 125000 })

    expect(edited.row).toEqual({ ...row, amount: 125000 })
  })

  it('takes the amount back to nothing, making the Expense Pending again', () => {
    const { household: after, row } = rent()

    const edited = editExpenseSnapshot(after, '2026-07', row.id, { amount: null })

    expect(isPending(edited.row)).toBe(true)
  })

  it('changes who a cost divides among, for this Month', () => {
    const { household: after, row } = rent()

    const edited = editExpenseSnapshot(after, '2026-07', row.id, { participants: [ana] })

    expect(edited.row.participants).toEqual([ana])
  })

  it('refuses to leave an Expense with nobody to divide among', () => {
    const { household: after, row } = rent()

    expect(() => editExpenseSnapshot(after, '2026-07', row.id, { participants: [] })).toThrow(
      DomainError,
    )
  })

  it('keeps the Expense’s identity, so its thread is unbroken', () => {
    const { household: after, row } = rent()

    const edited = editExpenseSnapshot(after, '2026-07', row.id, { name: 'Rent and service' })

    expect(edited.row.id).toBe(row.id)
  })

  it('changes the Month it names and no other', () => {
    const july = rent()
    const augustOpened = openMonth(july.household, '2026-08')
    const august = addExpenseSnapshot(augustOpened, '2026-08', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    })

    const edited = editExpenseSnapshot(august.household, '2026-07', july.row.id, { amount: 1 })

    expect(expensesIn(edited.household, '2026-07')[0]!.amount).toBe(1)
    expect(expensesIn(edited.household, '2026-08')[0]!.amount).toBe(120000)
  })

  it('refuses a row that is not in that Month', () => {
    expect(() => editExpenseSnapshot(household, '2026-07', 'no-such-row', { amount: 1 })).toThrow(
      DomainError,
    )
  })
})

describe('marking an Expense One-Off', () => {
  it('is not One-Off when recorded fresh', () => {
    const { row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana],
    })

    expect(isOneOff(row)).toBe(false)
  })

  it('sets an Expense One-Off without changing any other field', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Repair',
      category: 'Home',
      amount: 40000,
      participants: [ana],
    })

    const marked = setExpenseOneOff(after, '2026-07', row.id, true)

    expect(marked.row).toEqual({ ...row, oneOff: true })
  })

  it('clears the mark, changing no other field', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Repair',
      category: 'Home',
      amount: 40000,
      participants: [ana],
      oneOff: true,
    })

    const cleared = setExpenseOneOff(after, '2026-07', row.id, false)

    expect(cleared.row).toEqual({ ...row, oneOff: false })
  })

  it('succeeds and changes nothing else when the row is already in that state', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Repair',
      category: 'Home',
      amount: 40000,
      participants: [ana],
    })

    const marked = setExpenseOneOff(after, '2026-07', row.id, false)

    expect(marked.row).toEqual(row)
  })

  it('leaves the Unreviewed mark exactly as it found it, setting or clearing', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Repair',
      category: 'Home',
      amount: 40000,
      participants: [ana],
    }).household
    const august = openMonth(july, '2026-08')
    const row = monthAt(august, '2026-08')!.expenses[0]!
    expect(isReviewed(row)).toBe(false)

    const marked = setExpenseOneOff(august, '2026-08', row.id, true)
    expect(isReviewed(marked.row)).toBe(false)

    const cleared = setExpenseOneOff(marked.household, '2026-08', row.id, false)
    expect(isReviewed(cleared.row)).toBe(false)
  })

  it('refuses a row that is not in that Month', () => {
    expect(() => setExpenseOneOff(household, '2026-07', 'no-such-row', true)).toThrow(DomainError)
  })
})

describe('an Expense drafted One-Off', () => {
  it('is recorded One-Off when the draft asks for it', () => {
    const { row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Flight deposit',
      category: 'Travel',
      amount: 24000,
      participants: [ana],
      oneOff: true,
    })

    expect(isOneOff(row)).toBe(true)
  })

  it('is not inherited when the next Month opens', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Flight deposit',
      category: 'Travel',
      amount: 24000,
      participants: [ana],
      oneOff: true,
    }).household

    const august = openMonth(july, '2026-08')

    expect(monthAt(august, '2026-08')!.expenses).toEqual([])
  })
})

describe('removing an Expense', () => {
  it('takes the cost out of the Month', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana],
    })

    expect(expensesIn(removeExpenseSnapshot(after, '2026-07', row.id))).toEqual([])
  })

  it('leaves the other costs where they are', () => {
    const rent = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana],
    })
    const groceries = addExpenseSnapshot(rent.household, '2026-07', {
      name: 'Groceries',
      category: 'Home',
      amount: 30000,
      participants: [ana, bruno],
    })

    const removed = removeExpenseSnapshot(groceries.household, '2026-07', rent.row.id)

    expect(expensesIn(removed).map((row) => row.name)).toEqual(['Groceries'])
  })

  it('refuses a row that is not in that Month', () => {
    expect(() => removeExpenseSnapshot(household, '2026-07', 'no-such-row')).toThrow(DomainError)
  })
})

describe('what a set of Line Items comes to', () => {
  it('is nothing at all when there are none', () => {
    expect(totalOfLines([])).toBeNull()
  })

  it('is their sum', () => {
    expect(
      totalOfLines([
        { id: 'a', name: 'Fruit', amount: 1200 },
        { id: 'b', name: 'Meat', amount: 1800 },
      ]),
    ).toBe(3000)
  })

  it('is nothing at all when any one of them is Pending — a Pending line is not a zero', () => {
    expect(
      totalOfLines([
        { id: 'a', name: 'Fruit', amount: 1200 },
        { id: 'b', name: 'Water', amount: null },
      ]),
    ).toBeNull()
  })
})

describe('itemising an Expense', () => {
  it('turns the typed amount into a single line named after the Expense', () => {
    const { household: after, row } = groceries()

    const itemised = itemiseExpense(after, '2026-07', row.id)

    expect(itemised.row.lines).toEqual([
      { id: expect.any(String), name: 'Groceries', amount: 30000 },
    ])
  })

  it('leaves the total exactly where it was', () => {
    const { household: after, row } = groceries()

    const itemised = itemiseExpense(after, '2026-07', row.id)

    expect(itemised.row.amount).toBe(30000)
    expect(isComposite(itemised.row)).toBe(true)
  })

  it('leaves a fixed rule valid, because no money moved', () => {
    const { household: after, row } = fixedGroceries()

    const itemised = itemiseExpense(after, '2026-07', row.id)

    expect(itemised.row.splitRule).toEqual({
      kind: 'fixed',
      byMember: { [ana]: 20000, [bruno]: 10000 },
    })
    expect(itemised.row.amount).toBe(30000)
  })

  it('refuses an Expense with no amount to itemise — such a line needs a name', () => {
    const { household: after, row } = groceries(null)

    expect(() => itemiseExpense(after, '2026-07', row.id)).toThrow(DomainError)
  })

  it('refuses an Expense already made of lines — a further line needs a name', () => {
    const { household: after, row } = groceries()
    const itemised = itemiseExpense(after, '2026-07', row.id)

    expect(() => itemiseExpense(itemised.household, '2026-07', row.id)).toThrow(DomainError)
  })
})

describe('adding a Line Item', () => {
  it('keeps the figure already recorded as a line of its own', () => {
    const { household: after, row } = groceries()

    const added = addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })

    expect(added.row.lines.map((line) => [line.name, line.amount])).toEqual([
      ['Groceries', 30000],
      ['Fruit', 1200],
    ])
  })

  it('makes the amount the sum of the lines', () => {
    const { household: after, row } = groceries()

    const added = addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })

    expect(added.row.amount).toBe(31200)
  })

  it('adds to an Expense that had nothing entered without inventing a line for it', () => {
    const { household: after, row } = groceries(null)

    const added = addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })

    expect(added.row.lines.map((line) => line.name)).toEqual(['Fruit'])
    expect(added.row.amount).toBe(1200)
  })

  it('appends to a composite, leaving the lines already there alone', () => {
    const { household: after, row } = groceries()
    const first = itemiseExpense(after, '2026-07', row.id)

    const second = addLineItem(first.household, '2026-07', row.id, { name: 'Fruit', amount: 1200 })

    expect(second.row.lines.map((line) => line.id)).toEqual([
      first.row.lines[0]!.id,
      expect.any(String),
    ])
  })

  it('mints a distinct identity for every line', () => {
    const { household: after, row } = groceries(null)
    const first = addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })
    const second = addLineItem(first.household, '2026-07', row.id, { name: 'Meat', amount: 1800 })

    expect(new Set(second.row.lines.map((line) => line.id)).size).toBe(2)
  })

  it('records a line with no amount, which makes the whole composite Pending', () => {
    const { household: after, row } = groceries(null)
    const fruit = addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })

    const water = addLineItem(fruit.household, '2026-07', row.id, { name: 'Water', amount: null })

    expect(water.row.amount).toBeNull()
    expect(isPending(water.row)).toBe(true)
  })

  it('costs zero when every line is zero, which is not the same as Pending', () => {
    const { household: after, row } = groceries(null)
    const fruit = addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 0 })

    const meat = addLineItem(fruit.household, '2026-07', row.id, { name: 'Meat', amount: 0 })

    expect(meat.row.amount).toBe(0)
    expect(isPending(meat.row)).toBe(false)
  })

  it('needs a name', () => {
    const { household: after, row } = groceries()

    expect(() => addLineItem(after, '2026-07', row.id, { name: '  ', amount: 1200 })).toThrow(
      DomainError,
    )
  })

  it('refuses a line whose sum could no longer be held exactly, though each line can', () => {
    const enormous = 2 ** 52
    const { household: after, row } = groceries(null)
    const first = addLineItem(after, '2026-07', row.id, { name: 'One', amount: enormous })
    expect(first.row.amount).toBe(enormous)

    expect(() =>
      addLineItem(first.household, '2026-07', row.id, { name: 'Two', amount: enormous }),
    ).toThrow(DomainError)
  })

  it('cannot be added to a Month that has not been opened', () => {
    const { household: after, row } = groceries()

    expect(() =>
      addLineItem(after, '2026-08', row.id, { name: 'Fruit', amount: 1200 }),
    ).toThrow(DomainError)
  })

  it('refuses an amount that is not whole minor units', () => {
    const { household: after, row } = groceries()

    expect(() => addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 12.5 })).toThrow(
      DomainError,
    )
  })

  it('refuses a row that is not in that Month', () => {
    expect(() =>
      addLineItem(household, '2026-07', 'no-such-row', { name: 'Fruit', amount: 1200 }),
    ).toThrow(DomainError)
  })
})

describe('a Line Item against the Split Rule', () => {
  /** The composite of `fixedGroceries` with a second line, and a rule that totals to both. */
  const fixedAndFruit = () => {
    const { household: after, row } = fixedGroceries()
    const itemised = itemiseExpense(after, '2026-07', row.id)
    return addLineItem(
      itemised.household,
      '2026-07',
      row.id,
      { name: 'Fruit', amount: 1200 },
      { kind: 'fixed', byMember: { [ana]: 21200, [bruno]: 10000 } },
    )
  }

  it('refuses an added line that leaves a fixed rule no longer totalling', () => {
    const { household: after, row } = fixedGroceries()

    expect(() => addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })).toThrow(
      DomainError,
    )
  })

  it('adds the line when a rule that totals to the new sum is supplied alongside', () => {
    const { household: after, row } = fixedGroceries()

    const added = addLineItem(
      after,
      '2026-07',
      row.id,
      { name: 'Fruit', amount: 1200 },
      { kind: 'fixed', byMember: { [ana]: 21200, [bruno]: 10000 } },
    )

    expect(added.row.amount).toBe(31200)
    expect(added.row.splitRule).toEqual({
      kind: 'fixed',
      byMember: { [ana]: 21200, [bruno]: 10000 },
    })
  })

  it('refuses an edited line that leaves a fixed rule no longer totalling', () => {
    const { household: after, row } = fixedGroceries()
    const itemised = itemiseExpense(after, '2026-07', row.id)
    const line = itemised.row.lines[0]!

    expect(() =>
      editLineItem(itemised.household, '2026-07', row.id, line.id, { amount: 31000 }),
    ).toThrow(DomainError)
  })

  it('edits the line when a rule that totals to the new sum is supplied alongside', () => {
    const { household: after, row } = fixedGroceries()
    const itemised = itemiseExpense(after, '2026-07', row.id)
    const line = itemised.row.lines[0]!

    const edited = editLineItem(
      itemised.household,
      '2026-07',
      row.id,
      line.id,
      { amount: 31000 },
      { kind: 'fixed', byMember: { [ana]: 21000, [bruno]: 10000 } },
    )

    expect(edited.row.amount).toBe(31000)
    expect(edited.row.splitRule).toEqual({
      kind: 'fixed',
      byMember: { [ana]: 21000, [bruno]: 10000 },
    })
  })

  it('refuses a line edit that takes the amount to nothing under a fixed rule', () => {
    const { household: after, row } = fixedGroceries()
    const itemised = itemiseExpense(after, '2026-07', row.id)
    const line = itemised.row.lines[0]!

    expect(() =>
      editLineItem(itemised.household, '2026-07', row.id, line.id, { amount: null }),
    ).toThrow(DomainError)
  })

  it('refuses a removal that leaves a fixed rule no longer totalling', () => {
    const { household: after, row } = fixedAndFruit()
    const line = row.lines[1]!

    expect(() => removeLineItem(after, '2026-07', row.id, line.id)).toThrow(DomainError)
  })

  it('removes the line when a rule that totals to what is left is supplied alongside', () => {
    const { household: after, row } = fixedAndFruit()
    const line = row.lines[1]!

    const removed = removeLineItem(after, '2026-07', row.id, line.id, {
      kind: 'fixed',
      byMember: { [ana]: 20000, [bruno]: 10000 },
    })

    expect(removed.row.amount).toBe(30000)
    expect(removed.row.lines.map((each) => each.name)).toEqual(['Groceries'])
  })

  it('leaves the Household untouched when it refuses, so no half-applied edit lands', () => {
    const { household: after, row } = fixedGroceries()

    expect(() => addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })).toThrow(
      DomainError,
    )
    expect(expensesIn(after)[0]!.lines).toEqual([])
    expect(expensesIn(after)[0]!.amount).toBe(30000)
  })

  it('lets a percentage rule stand, since it names no figure to disagree with', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Groceries',
      category: 'Home',
      amount: 30000,
      participants: [ana, bruno],
      splitRule: { kind: 'percentage', byMember: { [ana]: 60, [bruno]: 40 } },
    })

    const added = addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })

    expect(added.row.amount).toBe(31200)
  })
})

describe('editing a Line Item', () => {
  it('changes the amount of the line it names, and the total with it', () => {
    const { household: after, row } = itemisedGroceries()

    const edited = editLineItem(after, '2026-07', row.id, row.lines[0]!.id, { amount: 1500 })

    expect(edited.row.lines[0]!.amount).toBe(1500)
    expect(edited.row.amount).toBe(3300)
  })

  it('leaves the other lines alone', () => {
    const { household: after, row } = itemisedGroceries()

    const edited = editLineItem(after, '2026-07', row.id, row.lines[0]!.id, { amount: 1500 })

    expect(edited.row.lines[1]).toEqual(row.lines[1])
  })

  it('takes a line back to nothing, making the whole composite Pending', () => {
    const { household: after, row } = itemisedGroceries()

    const edited = editLineItem(after, '2026-07', row.id, row.lines[0]!.id, { amount: null })

    expect(edited.row.amount).toBeNull()
  })

  it('renames a line, changing nothing else and minting no identity', () => {
    const { household: after, row } = itemisedGroceries()

    const edited = editLineItem(after, '2026-07', row.id, row.lines[0]!.id, { name: 'Greens' })

    expect(edited.row.lines[0]).toEqual({ ...row.lines[0]!, name: 'Greens' })
    expect(edited.row.amount).toBe(row.amount)
  })

  it('needs a name to rename to', () => {
    const { household: after, row } = itemisedGroceries()

    expect(() =>
      editLineItem(after, '2026-07', row.id, row.lines[0]!.id, { name: '   ' }),
    ).toThrow(DomainError)
  })

  it('leaves the One-Off mark exactly as it found it', () => {
    const { household: after, row } = itemisedGroceries()
    const marked = setExpenseOneOff(after, '2026-07', row.id, true)

    const edited = editLineItem(marked.household, '2026-07', row.id, row.lines[0]!.id, {
      amount: 1500,
    })

    expect(isOneOff(edited.row)).toBe(true)
  })

  it('clears the Unreviewed mark, as every edit to an Expense does', () => {
    const july = itemisedGroceries()
    const august = openMonth(july.household, '2026-08')
    const row = monthAt(august, '2026-08')!.expenses[0]!
    expect(isReviewed(row)).toBe(false)

    const edited = editLineItem(august, '2026-08', row.id, row.lines[0]!.id, { amount: 1500 })

    expect(isReviewed(edited.row)).toBe(true)
  })

  it('refuses a line that is not on that Expense', () => {
    const { household: after, row } = itemisedGroceries()

    expect(() => editLineItem(after, '2026-07', row.id, 'no-such-line', { amount: 1 })).toThrow(
      DomainError,
    )
  })
})

describe('removing a Line Item', () => {
  it('takes the line out and the total down with it', () => {
    const { household: after, row } = itemisedGroceries()

    const removed = removeLineItem(after, '2026-07', row.id, row.lines[0]!.id)

    expect(removed.row.lines.map((line) => line.name)).toEqual(['Meat'])
    expect(removed.row.amount).toBe(1800)
  })

  it('hands the running total back as a typed amount when the last line goes', () => {
    const { household: after, row } = itemisedGroceries()
    const one = removeLineItem(after, '2026-07', row.id, row.lines[0]!.id)

    const none = removeLineItem(one.household, '2026-07', row.id, row.lines[1]!.id)

    expect(none.row.lines).toEqual([])
    expect(none.row.amount).toBe(1800)
    expect(isComposite(none.row)).toBe(false)
  })

  it('leaves a fixed rule valid across the last removal, since the total is unchanged', () => {
    const { household: after, row } = fixedGroceries()
    const itemised = itemiseExpense(after, '2026-07', row.id)

    const simple = removeLineItem(itemised.household, '2026-07', row.id, itemised.row.lines[0]!.id)

    expect(simple.row.amount).toBe(30000)
    expect(simple.row.splitRule).toEqual({
      kind: 'fixed',
      byMember: { [ana]: 20000, [bruno]: 10000 },
    })
  })

  it('leaves a Pending Expense when the composite came to nothing at all', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Water',
      category: 'Home',
      amount: null,
      participants: [ana],
    })
    const line = addLineItem(after, '2026-07', row.id, { name: 'Standing charge', amount: null })

    const simple = removeLineItem(line.household, '2026-07', row.id, line.row.lines[0]!.id)

    expect(simple.row.lines).toEqual([])
    expect(isPending(simple.row)).toBe(true)
  })

  it('refuses a line that is not on that Expense', () => {
    const { household: after, row } = itemisedGroceries()

    expect(() => removeLineItem(after, '2026-07', row.id, 'no-such-line')).toThrow(DomainError)
  })
})

describe('an Expense made of lines', () => {
  /** A composite converted from a typed figure, so its one line carries the whole total. */
  const converted = () => {
    const { household: after, row } = groceries()
    return itemiseExpense(after, '2026-07', row.id)
  }

  it('refuses an amount typed at it directly — the lines are what it costs', () => {
    const { household: after, row } = converted()

    expect(() => editExpenseSnapshot(after, '2026-07', row.id, { amount: 1 })).toThrow(DomainError)
  })

  it('takes every other edit as any Expense does', () => {
    const { household: after, row } = converted()

    const edited = editExpenseSnapshot(after, '2026-07', row.id, { name: 'Supermarket' })

    expect(edited.row.name).toBe('Supermarket')
    expect(edited.row.lines).toEqual(row.lines)
    expect(edited.row.amount).toBe(30000)
  })

  it('carries every line into the next Month opened, identities intact', () => {
    const { household: after, row } = converted()
    const fruit = addLineItem(after, '2026-07', row.id, { name: 'Fruit', amount: 1200 })

    const august = openMonth(fruit.household, '2026-08')

    expect(monthAt(august, '2026-08')!.expenses[0]!.lines).toEqual(fruit.row.lines)
  })

  it('gives the new Month lines of its own, so editing one Month never reaches another', () => {
    const { household: after, row } = converted()
    const august = openMonth(after, '2026-08')
    const inherited = monthAt(august, '2026-08')!.expenses[0]!

    const edited = editLineItem(august, '2026-08', row.id, inherited.lines[0]!.id, {
      amount: 25000,
    })

    expect(expensesIn(edited.household, '2026-07')[0]!.lines[0]!.amount).toBe(30000)
    expect(expensesIn(edited.household, '2026-08')[0]!.lines[0]!.amount).toBe(25000)
  })
})

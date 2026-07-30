import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from './errors.js'
import {
  addExpenseSnapshot,
  editExpenseSnapshot,
  markExpenseOneOff,
  removeExpenseSnapshot,
} from './expenses.js'
import { setUpHousehold } from './household.js'
import { monthAt, openMonth } from './month.js'
import { isOneOff, isPending } from './rows.js'
import { isReviewed } from './review.js'
import type { Household, MemberId } from './types.js'

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
      participants: [ana, bruno],
      splitRule: { kind: 'even' },
      reviewed: true,
      oneOff: false,
    })
  })

  it('mints a stable identity when the Expense first appears', () => {
    const first = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: '',
      amount: 1,
      participants: [ana],
    })
    const second = addExpenseSnapshot(first.household, '2026-07', {
      name: 'Rent',
      category: '',
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
      category: '',
      amount: 1200,
      participants: [ana],
    })

    expect(row.category).toBe('')
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

  it('marks an Expense One-Off without changing any other field', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Repair',
      category: 'Home',
      amount: 40000,
      participants: [ana],
    })

    const marked = markExpenseOneOff(after, '2026-07', row.id)

    expect(marked.row).toEqual({ ...row, oneOff: true })
  })

  it('leaves the Unreviewed mark exactly as it found it', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Repair',
      category: 'Home',
      amount: 40000,
      participants: [ana],
    }).household
    const august = openMonth(july, '2026-08')
    const row = monthAt(august, '2026-08')!.expenses[0]!
    expect(isReviewed(row)).toBe(false)

    const marked = markExpenseOneOff(august, '2026-08', row.id)

    expect(isReviewed(marked.row)).toBe(false)
  })

  it('refuses a row that is not in that Month', () => {
    expect(() => markExpenseOneOff(household, '2026-07', 'no-such-row')).toThrow(DomainError)
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

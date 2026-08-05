import { describe, expect, it } from 'vitest'
import type {
  Household,
  MonthKey,
  PaymentMethod,
  PaymentMethodId,
  PaymentMethodUsage,
} from '../domain/index.js'
import { costOfDeleting, paymentMethodChoices, paymentMethodName } from './payment-methods.js'

const vocabulary = (...names: string[]): Household =>
  ({
    paymentMethods: names.map((name, index) => ({ id: `p${index}`, name })) as PaymentMethod[],
  }) as Household

const usage = (rowCount: number, ...months: string[]): PaymentMethodUsage => ({
  rowCount,
  months: months as MonthKey[],
})

describe('naming a row’s payment method', () => {
  it('gives the name the vocabulary holds', () => {
    expect(paymentMethodName(vocabulary('Card', 'Cash'), 'p1' as PaymentMethodId)).toBe('Cash')
  })

  it('names nothing for a row that has no payment method', () => {
    expect(paymentMethodName(vocabulary('Card'), null)).toBeUndefined()
  })

  /**
   * A chip is drawn from this, and no chip is the right rendering of a payment method
   * that is not there — the same reading an unset row gets. The clear that precedes a
   * delete is what keeps this from happening; a screen that has not caught up with
   * another member's delete yet is what makes it worth answering rather than throwing.
   */
  it('names nothing for an id the vocabulary no longer holds', () => {
    expect(paymentMethodName(vocabulary('Card'), 'gone' as PaymentMethodId)).toBeUndefined()
  })
})

describe('the order the vocabulary is offered in', () => {
  it('reads by name rather than by when each was added', () => {
    const household = vocabulary('Transfer', 'Card', 'Cash')

    expect(paymentMethodChoices(household).map((one) => one.name)).toEqual([
      'Card',
      'Cash',
      'Transfer',
    ])
  })

  /** Names differing only in case are the confusion the vocabulary exists to end, so
      neither may be sorted above the other on case alone. */
  it('orders without regard to case', () => {
    const household = vocabulary('cash', 'App', 'Debit')

    expect(paymentMethodChoices(household).map((one) => one.name)).toEqual([
      'App',
      'cash',
      'Debit',
    ])
  })

  it('leaves the Household’s own list alone', () => {
    const household = vocabulary('Transfer', 'Card')
    paymentMethodChoices(household)

    expect(household.paymentMethods.map((one) => one.name)).toEqual(['Transfer', 'Card'])
  })
})

describe('what deleting a payment method would cost', () => {
  it('costs nothing where no row holds it', () => {
    expect(costOfDeleting(usage(0))).toBeUndefined()
  })

  it('names the rows and the one Month they are in', () => {
    expect(costOfDeleting(usage(3, '2025-06'))).toBe('used by 3 rows in June 2025')
  })

  it('counts a single row as one rather than as 1 rows', () => {
    expect(costOfDeleting(usage(1, '2025-06'))).toBe('used by 1 row in June 2025')
  })

  /** The sentence the ticket asks for word for word: rows, Months, and the range. */
  it('names the row count, the Month count and the range across several Months', () => {
    const months = ['2025-06', '2025-07', '2026-08']

    expect(costOfDeleting(usage(34, ...months))).toBe(
      'used by 34 rows across 3 Months, June 2025 – August 2026',
    )
  })
})

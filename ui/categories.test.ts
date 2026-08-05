import { describe, expect, it } from 'vitest'
import type { Category, CategoryId, CategoryUsage, Household, MonthKey } from '../domain/index.js'
import { categoryName, categoryChoices, costOfDeleting } from './categories.js'

const vocabulary = (...names: string[]): Household =>
  ({
    categories: names.map((name, index) => ({ id: `c${index}`, name })) as Category[],
  }) as Household

const usage = (rowCount: number, ...months: string[]): CategoryUsage => ({
  rowCount,
  months: months as MonthKey[],
})

describe('naming a row’s category', () => {
  it('gives the name the vocabulary holds', () => {
    expect(categoryName(vocabulary('Groceries', 'Transport'), 'c1' as CategoryId)).toBe('Transport')
  })

  it('names nothing for a row that has no category', () => {
    expect(categoryName(vocabulary('Groceries'), null)).toBeUndefined()
  })

  /**
   * A chip is drawn from this, and no chip is the right rendering of a category that is
   * not there — the same reading an uncategorised row gets. The clear that precedes a
   * delete is what keeps this from happening; a screen that has not caught up with
   * another member's delete yet is what makes it worth answering rather than throwing.
   */
  it('names nothing for an id the vocabulary no longer holds', () => {
    expect(categoryName(vocabulary('Groceries'), 'gone' as CategoryId)).toBeUndefined()
  })
})

describe('the order the vocabulary is offered in', () => {
  it('reads by name rather than by when each was added', () => {
    const household = vocabulary('Transport', 'Bills', 'Groceries')

    expect(categoryChoices(household).map((one) => one.name)).toEqual([
      'Bills',
      'Groceries',
      'Transport',
    ])
  })

  /** Names differing only in case are the confusion the vocabulary exists to end, so
      neither may be sorted above the other on case alone. */
  it('orders without regard to case', () => {
    const household = vocabulary('bills', 'Attic', 'Cellar')

    expect(categoryChoices(household).map((one) => one.name)).toEqual([
      'Attic',
      'bills',
      'Cellar',
    ])
  })

  it('leaves the Household’s own list alone', () => {
    const household = vocabulary('Transport', 'Bills')
    categoryChoices(household)

    expect(household.categories.map((one) => one.name)).toEqual(['Transport', 'Bills'])
  })
})

describe('what deleting a category would cost', () => {
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

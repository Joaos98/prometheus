import { describe, expect, it } from 'vitest'
import { DomainError } from './errors.js'
import { monthAfter, monthBefore, monthKey, monthName, monthOfYear, yearOf } from './month-key.js'

describe('a Month key', () => {
  it('is a year and a month, January being 1', () => {
    expect(monthKey(2026, 7)).toBe('2026-07')
    expect(monthKey(2026, 12)).toBe('2026-12')
  })

  it('is refused for a month outside the year', () => {
    expect(() => monthKey(2026, 0)).toThrow(DomainError)
    expect(() => monthKey(2026, 13)).toThrow(DomainError)
  })

  it('says itself as the Household says it', () => {
    expect(monthName('2026-07')).toBe('July 2026')
  })

  it('reports the year and the month it stands for', () => {
    expect(yearOf('2026-07')).toBe(2026)
    expect(monthOfYear('2026-07')).toBe(7)
    expect(monthOfYear('2026-01')).toBe(1)
  })
})

describe('the Month next along the calendar', () => {
  it('is the following calendar month', () => {
    expect(monthAfter('2026-07')).toBe('2026-08')
    expect(monthBefore('2026-07')).toBe('2026-06')
  })

  it('crosses the turn of the year', () => {
    expect(monthAfter('2026-12')).toBe('2027-01')
    expect(monthBefore('2026-01')).toBe('2025-12')
  })

  it('steps back to where it started', () => {
    expect(monthAfter(monthBefore('2026-07'))).toBe('2026-07')
  })

  it('is refused for anything that is not a Month', () => {
    expect(() => monthAfter('August')).toThrow(DomainError)
    expect(() => monthBefore('2026-13')).toThrow(DomainError)
  })
})

import { describe, expect, it } from 'vitest'
import { formatAmount, plainAmount, toMinor } from './money.js'
import { DomainError } from './errors.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }
const yen = { code: 'JPY', symbol: '¥', decimals: 0 }

describe('amounts', () => {
  it('are integer minor units of the Household’s currency', () => {
    expect(toMinor('12.34', euro)).toBe(1234)
    expect(toMinor('0.05', euro)).toBe(5)
    expect(toMinor('1200', yen)).toBe(1200)
  })

  it('carry no floating point — a third of a cent cannot be entered', () => {
    expect(() => toMinor('12.345', euro)).toThrow(DomainError)
    expect(() => toMinor('12.5', yen)).toThrow(DomainError)
  })

  it('may be negative or zero, and zero is only ever zero', () => {
    expect(toMinor('0', euro)).toBe(0)
    expect(toMinor('-8.10', euro)).toBe(-810)
    expect(toMinor('-0.00', euro)).toBe(0)
  })

  it('read a comma as the decimal separator, as half the world types it', () => {
    expect(toMinor('12,34', euro)).toBe(1234)
  })

  it('refuse anything that is not an amount', () => {
    expect(() => toMinor('', euro)).toThrow(DomainError)
    expect(() => toMinor('twelve', euro)).toThrow(DomainError)
  })

  it('render at the currency’s precision', () => {
    expect(formatAmount(1234, euro)).toBe('€12.34')
    expect(formatAmount(5, euro)).toBe('€0.05')
    expect(formatAmount(-810, euro)).toBe('-€8.10')
    expect(formatAmount(120, yen)).toBe('¥120')
  })

  it('group their thousands, so a four-figure salary is scannable at a glance', () => {
    expect(formatAmount(320000, euro)).toBe('€3,200.00')
    expect(formatAmount(123456789, euro)).toBe('€1,234,567.89')
    expect(formatAmount(-320000, euro)).toBe('-€3,200.00')
    expect(formatAmount(1200, yen)).toBe('¥1,200')
    expect(formatAmount(99999, euro)).toBe('€999.99')
  })

  it('go back into a field as bare digits, which is how they are typed', () => {
    expect(plainAmount(320000, euro)).toBe('3200.00')
    expect(plainAmount(-810, euro)).toBe('-8.10')
    expect(plainAmount(1200, yen)).toBe('1200')
    expect(toMinor(plainAmount(320000, euro), euro)).toBe(320000)
  })
})

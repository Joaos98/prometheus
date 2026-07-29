import { describe, expect, it } from 'vitest'
import { formatAmount, toMinor } from './money.js'
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
    expect(formatAmount(1200, yen)).toBe('¥1200')
  })
})

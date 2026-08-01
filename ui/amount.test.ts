import { describe, expect, it } from 'vitest'
import { DomainError } from '../domain/index.js'
import { editableAmount, readAmount, readPercentage } from './amount.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

describe('an amount as a member types it', () => {
  it('is nothing at all when nothing is typed, which is Pending', () => {
    expect(readAmount('', euro)).toBeNull()
    expect(readAmount('   ', euro)).toBeNull()
  })

  it('reads a comma as the decimal separator', () => {
    expect(readAmount('12,34', euro)).toBe(1234)
    expect(readAmount('12.34', euro)).toBe(1234)
  })

  it('goes back into the field as bare digits, with no symbol and no grouping', () => {
    expect(editableAmount(320000, euro)).toBe('3200.00')
    expect(editableAmount(null, euro)).toBe('')
  })
})

describe('a percentage as a member types it', () => {
  it('reads a comma as readily as a full stop, the same as the amount beside it', () => {
    expect(readPercentage('66,67')).toBe(66.67)
    expect(readPercentage('66.67')).toBe(66.67)
    expect(readPercentage('50')).toBe(50)
  })

  it('is nothing at all when nothing is typed, which totals short of 100 and says so', () => {
    expect(readPercentage('')).toBe(0)
    expect(readPercentage('  ')).toBe(0)
  })

  it('refuses what is not a percentage, saying what was typed rather than NaN', () => {
    expect(() => readPercentage('half')).toThrow(DomainError)
    expect(() => readPercentage('33%')).toThrow(DomainError)
    expect(() => readPercentage('half')).toThrow('"half" is not a percentage')
  })

  it('hands a negative one on, for the engine to refuse in its own words', () => {
    expect(readPercentage('-10')).toBe(-10)
  })
})

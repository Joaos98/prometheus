import { describe, expect, it } from 'vitest'
import { apportion } from './apportion.js'

const sum = (amounts: number[]): number => amounts.reduce((total, amount) => total + amount, 0)

describe('apportion', () => {
  it('divides a total that splits cleanly into equal shares', () => {
    expect(apportion(9000, [1n, 1n, 1n])).toEqual([3000, 3000, 3000])
  })

  it('sums to exactly the total when it does not divide evenly', () => {
    const shares = apportion(10000, [1n, 1n, 1n])

    expect(shares).toEqual([3334, 3333, 3333])
    expect(sum(shares)).toBe(10000)
  })

  it('places the leftover units one each, never all on the same weight', () => {
    expect(apportion(10001, [1n, 1n, 1n])).toEqual([3334, 3334, 3333])
  })

  it('breaks a tie between equal remainders by position, not by weight order', () => {
    expect(apportion(10000, [1n, 1n, 1n])).toEqual([3334, 3333, 3333])
  })

  it('gives a zero weight zero, however the rest divide', () => {
    expect(apportion(10000, [1n, 1n, 0n])).toEqual([5000, 5000, 0])
  })

  it('weights shares by size, not just by presence', () => {
    expect(apportion(120000, [3n, 1n])).toEqual([90000, 30000])
  })

  it('sums to exactly the total for every total and every number of weights', () => {
    const weightSets = [[1n], [1n, 1n], [1n, 1n, 1n], [3n, 1n], [1n, 1n, 1n, 1n]]

    for (let total = -500; total <= 500; total++) {
      for (const weights of weightSets) {
        const shares = apportion(total, weights)
        expect(sum(shares), `${total} across ${weights.length} weights`).toBe(total)
      }
    }
  })

  it('divides a negative total exactly, keeping the same remainder discipline', () => {
    const shares = apportion(-10000, [1n, 1n, 1n])

    expect(shares).toEqual([-3333, -3333, -3334])
    expect(sum(shares)).toBe(-10000)
  })

  it('never leaves any weight more than one unit from its exact share', () => {
    const shares = apportion(10000, [1n, 1n, 1n])

    for (const share of shares) {
      expect(Math.abs(share - 10000 / 3)).toBeLessThan(1)
    }
  })

  it('is the same twice over for the same inputs', () => {
    expect(apportion(10000, [1n, 1n, 1n])).toEqual(apportion(10000, [1n, 1n, 1n]))
  })

  it('is each zero for a total of zero, which is an answer', () => {
    expect(apportion(0, [1n, 1n])).toEqual([0, 0])
  })

  it('refuses weights that all come to nothing, rather than dividing by zero', () => {
    expect(() => apportion(100, [0n, 0n])).toThrow('weights must not all be zero')
  })
})

import type { Currency } from '../domain/index.js'

/** A starting point for setup. The currency can be relabelled afterwards. */
export const CURRENCIES: Currency[] = [
  { code: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', symbol: '£', decimals: 2 },
  { code: 'USD', symbol: '$', decimals: 2 },
  { code: 'BRL', symbol: 'R$', decimals: 2 },
  { code: 'CHF', symbol: 'CHF ', decimals: 2 },
  { code: 'JPY', symbol: '¥', decimals: 0 },
]

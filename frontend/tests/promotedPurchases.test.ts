import { describe, expect, it } from 'vitest'

import {
  normalizePromotedProductId,
  promotedPurchasePath,
} from '../src/promotedPurchases'

describe('promoted purchases', () => {
  it('normalizes valid App Store product identifiers', () => {
    expect(normalizePromotedProductId(' FHFS001 ')).toBe('FHFS001')
    expect(normalizePromotedProductId('com.quantech.filscore.reports')).toBe(
      'com.quantech.filscore.reports',
    )
  })

  it('rejects malformed product identifiers', () => {
    expect(normalizePromotedProductId('')).toBeNull()
    expect(normalizePromotedProductId('product?id=1')).toBeNull()
    expect(normalizePromotedProductId('a'.repeat(256))).toBeNull()
  })

  it('creates a safe subscription payment route', () => {
    expect(promotedPurchasePath('FHFS003')).toBe(
      '/subscription-payment?promotedProductId=FHFS003',
    )
  })
})

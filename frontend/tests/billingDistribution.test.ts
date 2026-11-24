import { describe, expect, it } from 'vitest'

import {
  resolveDistributionChannel,
  resolveStoreBillingPolicy,
} from '../src/billingDistribution'

describe('billing distribution policy', () => {
  it('fails closed to Apple billing for an App Store build', () => {
    expect(resolveStoreBillingPolicy('app-store', false, 'web')).toEqual({
      usesAppleStore: true,
      usesGooglePlay: false,
      usesNativeStore: true,
    })
  })

  it('uses Google Play billing for a Play Store build', () => {
    expect(resolveStoreBillingPolicy('play-store', false, 'web')).toEqual({
      usesAppleStore: false,
      usesGooglePlay: true,
      usesNativeStore: true,
    })
  })

  it('preserves native detection for local mobile development', () => {
    expect(resolveStoreBillingPolicy('web', true, 'ios').usesAppleStore).toBe(true)
    expect(resolveStoreBillingPolicy('web', true, 'android').usesGooglePlay).toBe(true)
  })

  it('defaults unknown distribution values to web', () => {
    expect(resolveDistributionChannel('unexpected')).toBe('web')
    expect(resolveDistributionChannel(undefined)).toBe('web')
  })
})

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetMyStoreEntitlements, mockGetMySubscription, platform } = vi.hoisted(() => ({
  mockGetMyStoreEntitlements: vi.fn(),
  mockGetMySubscription: vi.fn(),
  platform: { value: 'web' },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => platform.value },
}))

vi.mock('../src/api', () => ({
  getMyStoreEntitlements: mockGetMyStoreEntitlements,
  getMySubscription: mockGetMySubscription,
}))

import { usePaidScoreCertificationAccess } from '../src/hooks/usePaidScoreCertificationAccess'

describe('usePaidScoreCertificationAccess', () => {
  beforeEach(() => {
    platform.value = 'web'
    mockGetMyStoreEntitlements.mockReset()
    mockGetMySubscription.mockReset()
  })

  it('allows active paid subscriptions', async () => {
    mockGetMySubscription.mockResolvedValue({ status: 'ACTIVE', subscription_type: 'PAID' })

    const { result } = renderHook(() => usePaidScoreCertificationAccess(false))

    await waitFor(() => expect(result.current.isScoreAccessLoading).toBe(false))
    expect(result.current.hasPaidScoreAccess).toBe(true)
  })

  it.each([
    { status: 'TRIAL', subscription_type: 'FREE' },
    { status: 'ACTIVE', subscription_type: 'FREE' },
    { status: 'TRIAL', subscription_type: 'PAID' },
  ])('blocks score certificates for $status $subscription_type subscriptions', async (subscription) => {
    mockGetMySubscription.mockResolvedValue(subscription)

    const { result } = renderHook(() => usePaidScoreCertificationAccess(false))

    await waitFor(() => expect(result.current.isScoreAccessLoading).toBe(false))
    expect(result.current.hasPaidScoreAccess).toBe(false)
  })

  it('allows administrators without requiring a subscription request', () => {
    const { result } = renderHook(() => usePaidScoreCertificationAccess(true))

    expect(result.current.hasPaidScoreAccess).toBe(true)
    expect(result.current.isScoreAccessLoading).toBe(false)
    expect(mockGetMySubscription).not.toHaveBeenCalled()
  })

  it('uses category entitlements for Android without changing subscription lookup', async () => {
    platform.value = 'android'
    mockGetMyStoreEntitlements.mockResolvedValue({
      subscription_grants_all: false,
      reports: true,
      statements: false,
      certifications: false,
      scores: false,
    })

    const { result } = renderHook(() => usePaidScoreCertificationAccess(false, 'REPORTS'))

    await waitFor(() => expect(result.current.isScoreAccessLoading).toBe(false))
    expect(result.current.hasPaidScoreAccess).toBe(true)
    expect(mockGetMySubscription).not.toHaveBeenCalled()
  })
})

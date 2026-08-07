import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetMySubscription } = vi.hoisted(() => ({
  mockGetMySubscription: vi.fn(),
}))

vi.mock('../src/api', () => ({
  getMySubscription: mockGetMySubscription,
}))

import { usePaidScoreCertificationAccess } from '../src/hooks/usePaidScoreCertificationAccess'

describe('usePaidScoreCertificationAccess', () => {
  beforeEach(() => {
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
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import SelectedProfileIdCard, { resolveSelectedProfileId } from '../src/components/profile/SelectedProfileIdCard'
import { resolveSelectedApplicationNo } from '../src/hooks/useSelectedAnalysisEntity'
import {
  estimateYearsToTargetNetWorth,
  resolveActualNetWorthPosition,
} from '../src/pages/scoring/NetWorthPositioningPage'

describe('selected profile identity', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
  })

  it('uses the repository-selected application number before other profile identities', () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-LOCAL',
      values: {},
    }))

    expect(resolveSelectedProfileId(new URLSearchParams(
      'applicationNo=APP-SELECTED&profileId=PRO-QUERY',
    ))).toBe('APP-SELECTED')
  })

  it('uses the persisted Build Profile ID when the URL has no profile selection', () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-LOCAL',
      values: {},
    }))

    expect(resolveSelectedProfileId(new URLSearchParams())).toBe('PRO-LOCAL')
  })

  it('renders a compact record ID with the selected name when requested', () => {
    window.history.replaceState({}, '', '/?applicationNo=APP-123')

    render(<SelectedProfileIdCard compactId label="Record ID" name="Jane Doe" />)

    expect(screen.getByText('Record ID')).toBeTruthy()
    expect(screen.getByText('APP-123').classList.contains('selected-profile-id-compact')).toBe(true)
    expect(screen.getByText('Jane Doe')).toBeTruthy()
  })

  it('uses only an actual application selection for report analysis', () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-LOCAL',
      selectedApplicationNo: 'APP-ANALYSIS',
      values: {},
    }))

    expect(resolveSelectedApplicationNo(new URLSearchParams())).toBe('APP-ANALYSIS')
    expect(resolveSelectedApplicationNo(new URLSearchParams('applicationNo=APP-QUERY'))).toBe('APP-QUERY')
  })
})

describe('net worth target estimate', () => {
  it('converts the remaining target gap into years of declared income', () => {
    expect(estimateYearsToTargetNetWorth(400_000, 1_000_000, 50_000)).toBe(1)
  })

  it('handles achieved targets and missing declared income', () => {
    expect(estimateYearsToTargetNetWorth(1_100_000, 1_000_000, 50_000)).toBe(0)
    expect(estimateYearsToTargetNetWorth(400_000, 1_000_000, 0)).toBeNull()
  })

  it('uses only Build Profile Step 9 actual assets and liabilities', () => {
    expect(resolveActualNetWorthPosition({
      'asset-cash-on-hand': '800000',
      'liability-personal-loan': '250000',
      'income-salary': '50000',
      'asset-savings-account': '',
    }, 100000)).toBe(550000)
  })

  it('uses the setup position when Step 9 has no balance-sheet actuals', () => {
    expect(resolveActualNetWorthPosition({ 'income-salary': '50000' }, 100000)).toBe(100000)
  })
})
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import FinancialStatementModal from '../src/pages/admin/AdminFinancialStatementPage'
import { computeFinancialHealthSummary } from '../src/pages/scoring/financialHealthSummaryEngine'
import { getFinancialHealthBand } from '../src/pages/scoring/financialHealthModel'

function createStorageMock(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

describe('FinancialStatementModal', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PROFILE-LIVE-1',
      completionPercent: 88,
      values: {
        wealthCurrency: 'PHP',
        'asset-cash-on-hand': '250000',
        'asset-savings-account': '500000',
        'liability-personal-loan': '100000',
        'income-salary': '120000',
        'expense-housing': '30000',
      },
      documents: [],
      suitabilityAnswers: { riskCapacity: '4', investmentDiscipline: '4' },
      coBorrowers: [],
      guarantors: [],
      additionalCollaterals: [],
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders cover charts from supplied financial and Build Profile values', () => {
    const financialHealthSummary = computeFinancialHealthSummary({
      credit: 60,
      'cash-flow': 65,
      wealth: 70,
      budget: 55,
      payment: 75,
      protection: 50,
      investment: 45,
      goal: 60,
    })

    expect(financialHealthSummary.score).not.toBe(842)

    render(<FinancialStatementModal
      onClose={() => undefined}
      financialHealthSummary={financialHealthSummary}
      creditScores={{ credit: 700, nonStarter: 650, social: 600, psychometric: 550 }}
    />)

    const statement = screen.getByRole('dialog', { name: 'Statement of Assets and Liabilities' })
    expect(statement.querySelector('.admin-cover-ring-score strong')?.textContent)
      .toBe(String(financialHealthSummary.score))
    expect(statement.querySelector('.admin-cover-health-band strong')?.textContent)
      .toBe(getFinancialHealthBand(financialHealthSummary.score))

    const creditPanel = statement.querySelector('.admin-cover-credit')
    expect(creditPanel?.textContent).toContain('700')
    expect(creditPanel?.textContent).toContain('650')
    expect(creditPanel?.textContent).toContain('600')
    expect(creditPanel?.textContent).toContain('550')

    const wealthBehaviour = [...statement.querySelectorAll('.wealth-balance-radar-indicator')]
      .find((indicator) => indicator.textContent?.includes('Wealth Behaviour'))
    expect(wealthBehaviour?.querySelector('strong')?.textContent).toBe('100')
    expect(statement.textContent).toContain('88% information provided')
  })
})

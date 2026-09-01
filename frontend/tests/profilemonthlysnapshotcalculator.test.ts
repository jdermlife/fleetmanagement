import { describe, expect, it, vi } from 'vitest'

import { api } from '../src/api'
import {
  calculateAndSaveMonthlyProfile,
  calculateMonthlyProfile,
  type MonthlyProfileCalculatorInput,
} from '../src/services/profilemonthlysnapshotcalculator'

vi.mock('../src/api', () => ({ api: { put: vi.fn() } }))

const input: MonthlyProfileCalculatorInput = {
  snapshotMonth: '2026-08',
  profileData: { profileId: 'P-7' },
  sourceProfileId: 'P-7',
  financialHealth: { credit: 80, budget: 75, wealth: 70 },
  creditHealth: { score: 81, summary: { grade: 'B' } },
  netWorth: { amounts: { 'asset-savings-account': 100000, 'income-salary': 50000, 'expense-rent': 15000 } },
  budget: { incomeDraft: { salary: 50000 }, expenseDraft: { rent: 15000 } },
  loanMonitoring: {
    daysPastDue: 0,
    beginningBalance: 100000,
    currentBalance: 80000,
    dsrPercent: 25,
    utilizationPercent: 35,
    ltvPercent: 55,
    activeLoanCount: 1,
    highInterestLoanCount: 0,
    distinctLoanTypeCount: 1,
    distinctLenderCount: 1,
    refinancingImprovesCashFlow: false,
    consolidationOpportunity: false,
  },
  billPayment: { billers: [], monthlyIncome: 50000, referenceDate: '2026-08-31' },
  wealthComposite: { wealthBehaviourScore: 70, wealthAuthenticityScore: 80 },
  widBenchmark: { netWorth: 100000, annualIncome: 600000, countryCode: 'PH', currency: 'PHP' },
}

describe('monthly profile snapshot calculator', () => {
  it('calls the existing engines and persists their returned scores and summaries', async () => {
    const expected = calculateMonthlyProfile(input)
    vi.mocked(api.put).mockResolvedValue({ data: { id: 1 } } as never)

    const result = await calculateAndSaveMonthlyProfile(input)

    expect(api.put).toHaveBeenCalledOnce()
    expect(expected.financialHealth.indicators.find(({ id }) => id === 'wealth')?.score)
      .toBe(expected.netWorth.normalizedScore)
    expect(expected.financialHealth.indicators.find(({ id }) => id === 'budget')?.score)
      .toBe(expected.budget.score)
    expect(api.put).toHaveBeenCalledWith(
      '/api/profile-monthly-snapshots/2026-08-01',
      expect.objectContaining({
        financial_health_score: expected.financialHealth.score,
        credit_health_score: 81,
        net_worth_positioning_score: expected.wealthComposite.normalizedScore,
        budget_tracking_score: expected.budget.score,
        loan_monitoring_score: expected.loanMonitoring.score,
        bill_reminder_score: expected.billPayment.score,
        net_worth_summary: expect.objectContaining({
          netWorthBuilding: expected.netWorth,
          wealthFoundation: expected.wealthFoundation,
          wealthComposite: expected.wealthComposite,
          widBenchmark: expected.widBenchmark,
        }),
      }),
    )
    expect(result.calculations).toEqual(expected)
  })
})
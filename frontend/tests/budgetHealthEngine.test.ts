import { describe, expect, it } from 'vitest'

import { computeBudgetHealthScore, type BudgetHealthDraftInput } from '../src/pages/scoring/budgetHealthEngine'

function completeDraft(): BudgetHealthDraftInput {
  return {
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    incomeDraft: { salary: '100000' },
    expenseDraft: { housing: '30000', food: '15000', savings: '30000' },
    expenseAllocationDraft: {
      housing: '30',
      'food-dining': '15',
      transport: '10',
      insurance: '5',
      'savings-core': '30',
      entertainment: '10',
    },
    savedSetup: [
      { id: 'income-salary', setupAmount: 100000, type: 'income' },
      { id: 'expense-housing', setupAmount: 30000, type: 'expense' },
      { id: 'expense-food', setupAmount: 15000, type: 'expense' },
      { id: 'expense-savings', setupAmount: 30000, type: 'expense' },
    ],
    actualEntries: {
      'income-salary': '100000',
      'expense-housing': '30000',
      'expense-food': '15000',
      'expense-savings': '30000',
    },
    cashFlowHistory: Array.from({ length: 12 }, () => ({
      income: 100000,
      expenses: 75000,
      budgetVariancePercent: 2,
      budgetCompleted: true,
    })),
  }
}

describe('computeBudgetHealthScore', () => {
  it('computes all five weighted components from a completed tracker', () => {
    const result = computeBudgetHealthScore(completeDraft())

    expect(result).toMatchObject({
      score: 98,
      planning: 20,
      adherence: 30,
      savingsDiscipline: 18,
      expenseAllocation: 15,
      cashFlowStability: 15,
      aiAdjustment: 0,
    })
    expect(result.metrics.variancePercent).toBe(0)
    expect(result.metrics.savingsRatePercent).toBe(25)
  })

  it('applies supported modifiers and caps the final score at 100', () => {
    const result = computeBudgetHealthScore({
      ...completeDraft(),
      adjustments: {
        billsAlwaysPaidOnTime: true,
        incomeSteadilyIncreasing: true,
        expensesConsistentlyDecreasing: true,
        emergencyFundMonths: 6,
      },
    })

    expect(result.aiAdjustment).toBe(8)
    expect(result.score).toBe(100)
  })

  it('penalizes negative cash flow and does not treat blank actuals as zero', () => {
    const draft = completeDraft()
    draft.actualEntries = {}
    draft.incomeDraft = { salary: '50000' }
    draft.expenseDraft = { housing: '60000' }

    const result = computeBudgetHealthScore(draft)

    expect(result.adherence).toBe(0)
    expect(result.savingsDiscipline).toBe(0)
    expect(result.cashFlowStability).toBe(15)
    expect(result.aiAdjustment).toBe(-8)
  })
})
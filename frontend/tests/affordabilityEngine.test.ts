import { describe, expect, it } from 'vitest'

import { computeAffordability, type AffordabilityInputs } from '../src/pages/scoring/affordabilityEngine'

const affordableInputs: AffordabilityInputs = {
  netMonthlyIncome: 180000,
  essentialLivingExpenses: 55000,
  existingDebtPayments: 12000,
  minimumSavingsRequirement: 18000,
  existingGoalContributions: 10000,
  principalAmount: 900000,
  annualInterestRate: 6,
  termMonths: 60,
  monthlyAmortization: 0,
  insurancePerYear: 24000,
  maintenancePerMonth: 4000,
  fuelPerMonth: 6000,
  otherExpensesPerMonth: 2000,
  monthlyBenefit: 5000,
  emergencyFundBalance: 450000,
  financialHealthScore: 85,
  spendingStabilityScore: 88,
  goalImpactPercent: 10,
}

describe('computeAffordability', () => {
  it('calculates full ownership cost, weighted score, and stress scenarios', () => {
    const result = computeAffordability(affordableInputs)

    expect(result.calculatedMonthlyAmortization).toBeGreaterThan(17000)
    expect(result.totalMonthlyPayment).toBeGreaterThan(result.monthlyAmortizationUsed)
    expect(result.netMonthlyPayment).toBe(result.totalMonthlyPayment - affordableInputs.monthlyBenefit)
    expect(result.paymentBurdenPercent).toBeGreaterThan(0)
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(result.stressScenarios).toHaveLength(3)
    expect(result.stressScenarios[2].capacity).toBeLessThan(result.stressScenarios[0].capacity)
  })

  it('applies the negative-cash-flow hard stop over the weighted score', () => {
    const result = computeAffordability({
      ...affordableInputs,
      netMonthlyIncome: 50000,
      essentialLivingExpenses: 42000,
      existingDebtPayments: 15000,
    })

    expect(result.hardRules.find((rule) => rule.id === 'negativeCashFlow')?.triggered).toBe(true)
    expect(result.score).toBeLessThan(60)
    expect(result.recommendation).toBe('Not recommended')
  })
})

import { describe, expect, it } from 'vitest'

import { computeBillPaymentHealthScore } from '../src/pages/scoring/billPaymentHealthEngine'

describe('computeBillPaymentHealthScore', () => {
  it('awards 100 points for early, complete, affordable, on-budget, automated payments', () => {
    const result = computeBillPaymentHealthScore({
      monthlyIncome: 20_000,
      referenceDate: '2026-07-30',
      billers: [
        {
          id: 'electric',
          estimatedDueDay: 20,
          dateCovered: '2026-07-31',
          budgetedAmount: 2_000,
          frequency: 'Monthly',
          emailReminder10DaysBefore: true,
          payments: [{ datePaid: '2026-07-15', amountPaid: 2_000 }],
        },
      ],
    })

    expect(result.score).toBe(100)
    expect(result.grade).toBe('A+')
    expect(result.components).toEqual({
      paymentTimeliness: 25,
      paymentCompletion: 20,
      budgetAdherence: 15,
      billAffordability: 15,
      reminderDiscipline: 10,
      paymentConsistency: 10,
      aiFinancialBehavior: 5,
    })
  })

  it('uses the date cumulative payments complete the bill for timeliness', () => {
    const result = computeBillPaymentHealthScore({
      monthlyIncome: 10_000,
      referenceDate: '2026-07-30',
      billers: [
        {
          id: 'water',
          estimatedDueDay: 10,
          dateCovered: '2026-07-31',
          budgetedAmount: 1_000,
          frequency: 'Monthly',
          emailReminder10DaysBefore: true,
          payments: [
            { datePaid: '2026-07-08', amountPaid: 500 },
            { datePaid: '2026-07-14', amountPaid: 500 },
          ],
        },
      ],
    })

    expect(result.components.paymentTimeliness).toBe(15)
    expect(result.components.paymentCompletion).toBe(20)
    expect(result.metrics.latePaymentCount).toBe(1)
  })

  it('scores partial payment and variance using the specified bands', () => {
    const result = computeBillPaymentHealthScore({
      monthlyIncome: 5_000,
      referenceDate: '2026-07-30',
      billers: [
        {
          id: 'internet',
          estimatedDueDay: 15,
          dateCovered: '2026-07-31',
          budgetedAmount: 1_000,
          frequency: 'Monthly',
          payments: [{ datePaid: '2026-07-16', amountPaid: 850 }],
        },
      ],
    })

    expect(result.components.paymentTimeliness).toBe(20)
    expect(result.components.paymentCompletion).toBe(15)
    expect(result.components.budgetAdherence).toBe(10)
    expect(result.components.reminderDiscipline).toBe(0)
    expect(result.components.aiFinancialBehavior).toBeLessThan(0)
  })

  it('converts non-monthly obligations and does not reward missing payment evidence', () => {
    const result = computeBillPaymentHealthScore({
      monthlyIncome: 10_000,
      referenceDate: '2026-07-30',
      billers: [
        {
          id: 'insurance',
          estimatedDueDay: 31,
          dateCovered: '2026-07-31',
          budgetedAmount: 12_000,
          frequency: 'Annual',
          emailReminder10DaysBefore: true,
          payments: [],
        },
      ],
    })

    expect(result.metrics.monthlyBills).toBe(1_000)
    expect(result.components.billAffordability).toBe(15)
    expect(result.components.paymentTimeliness).toBe(0)
    expect(result.components.paymentCompletion).toBe(0)
    expect(result.components.budgetAdherence).toBe(0)
    expect(result.components.paymentConsistency).toBe(0)
  })
})
import { describe, expect, it } from 'vitest'

import {
  buildCashBasisCalendar,
  calculateCashBasisTotals,
  normalizeMonth,
} from '../src/pages/scoring/cashBasisCalendar'

describe('cash basis calendar', () => {
  it('builds every day for the selected month', () => {
    const days = buildCashBasisCalendar('2028-02')

    expect(days).toHaveLength(29)
    expect(days[0]).toMatchObject({ dateKey: '2028-02-01', day: 1 })
    expect(days[28]).toMatchObject({ dateKey: '2028-02-29', day: 29 })
  })

  it('calculates income, expenses, and net for visible days only', () => {
    const days = buildCashBasisCalendar('2026-10')
    const totals = calculateCashBasisTotals(days, {
      '2026-10-01': { income: '1000', expenses: '250' },
      '2026-10-02': { income: '500.50', expenses: '100.25' },
      '2026-09-30': { income: '9000', expenses: '0' },
    })

    expect(totals).toEqual({ income: 1500.5, expenses: 350.25, net: 1150.25 })
  })

  it('normalizes invalid saved months to the supplied fallback month', () => {
    expect(normalizeMonth('', new Date(2026, 9, 10))).toBe('2026-10')
  })
})
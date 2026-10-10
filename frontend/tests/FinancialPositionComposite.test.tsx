import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import FinancialPositionComposite from '../src/pages/scoring/FinancialPositionComposite'

describe('FinancialPositionComposite', () => {
  it('combines the three position scores into a horizontal summary bar', () => {
    render(
      <FinancialPositionComposite
        cashFlowScore={88}
        creditHealthScore={91}
        netWorthGrowthScore={82}
      />,
    )

    expect(screen.getByRole('figure', { name: 'Combined Financial Position: 87 out of 100' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Cash Flow Position: 88 out of 100' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Credit Health: 91 out of 100' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Net Worth Growth: 82 out of 100' })).toBeTruthy()
    expect(screen.getAllByText('Strong')).toHaveLength(3)
  })

  it('clamps scores and assigns result statuses', () => {
    render(
      <FinancialPositionComposite
        cashFlowScore={120}
        creditHealthScore={65}
        netWorthGrowthScore={42}
      />,
    )

    expect(screen.getByRole('progressbar', { name: 'Cash Flow Position: 100 out of 100' })).toBeTruthy()
    expect(screen.getByText('Watch')).toBeTruthy()
    expect(screen.getByText('Action needed')).toBeTruthy()
  })
})
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import CalculationPage from '../src/pages/admin/CalculationPage'

describe('CalculationPage', () => {
  afterEach(() => cleanup())

  it('shows the Financial Health calculation model and formulas', () => {
    render(<CalculationPage />)

    expect(screen.getByRole('heading', { name: 'Calculation Models' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Financial Health Summary Engine' })).toBeTruthy()
    expect(screen.getByText('(91 x 15 + 88 x 14 + 94 x 14) / 43 = 91.0')).toBeTruthy()
    expect(screen.getByText('(86 x 11 + 79 x 10 + 76 x 10) / 31 = 80.5')).toBeTruthy()
    expect(screen.getByText('(71 x 11 + 82 x 15) / 26 = 77.3')).toBeTruthy()
    expect(screen.getByText('84.2 x 10 = 842')).toBeTruthy()
  })
})
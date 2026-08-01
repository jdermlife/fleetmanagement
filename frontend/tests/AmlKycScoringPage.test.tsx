import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import AmlKycScoringPage from '../src/pages/admin/AmlKycScoringPage'

describe('AmlKycScoringPage', () => {
  afterEach(() => cleanup())

  it('hides option points and calculates a completed assessment', async () => {
    const user = userEvent.setup()
    render(<AmlKycScoringPage />)

    expect(screen.getByRole('heading', { name: 'AML / KYC Risk Assessment' })).toBeTruthy()
    expect(screen.getAllByRole('combobox')).toHaveLength(10)
    expect(screen.queryByRole('option', { name: /15 points/i })).toBeNull()
    expect(screen.getByText('Complete all ten sections to calculate the AML score and risk classification.')).toBeTruthy()

    const selections = [
      ['Customer Identity Verification', 'Government-issued ID verified manually'],
      ['Source of Funds', 'Salary/business income without complete documents'],
      ['Source of Wealth', 'Mostly documented'],
      ['Politically Exposed Person Screening', 'Former PEP (more than 5 years)'],
      ['Sanctions Screening', 'False positive cleared'],
      ['Adverse Media Screening', 'Minor civil issues'],
      ['Geographic Risk', 'Medium-risk jurisdiction'],
      ['Nature of Business', 'Registered corporation'],
      ['Transaction Profile', 'Slightly higher than expected'],
      ['Beneficial Ownership', 'Ownership fully disclosed'],
    ] as const

    for (const [label, answer] of selections) {
      await user.selectOptions(screen.getByRole('combobox', { name: label }), answer)
    }

    const result = screen.getByRole('region', { name: 'AML Risk Classification' })
    expect(within(result).getByText('80 / 100')).toBeTruthy()
    expect(within(result).getByText('Low Risk')).toBeTruthy()
    expect(within(result).getByText('Standard Customer Due Diligence (CDD)')).toBeTruthy()
  })
})
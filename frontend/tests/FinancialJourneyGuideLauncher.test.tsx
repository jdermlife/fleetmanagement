import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import FinancialJourneyGuideLauncher from '../src/components/financial-health/FinancialJourneyGuideLauncher'

describe('FinancialJourneyGuideLauncher', () => {
  afterEach(cleanup)

  it('keeps the journey closed until the User Guide button is selected', async () => {
    render(<FinancialJourneyGuideLauncher applicationNo="APP-001" currentStep="creditHealth" />)

    expect(screen.queryByRole('dialog', { name: 'Welcome to Your Financial Health Journey!' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Financial Journey Guide' }))

    const dialog = screen.getByRole('dialog', { name: 'Welcome to Your Financial Health Journey!' })
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('listitem', { current: 'step' }).textContent).toContain('Loan & Wealth Ready?')

    await userEvent.click(screen.getByRole('button', { name: 'Minimize Financial Health Journey' }))
    expect(screen.queryByRole('dialog', { name: 'Welcome to Your Financial Health Journey!' })).toBeNull()
  })
})

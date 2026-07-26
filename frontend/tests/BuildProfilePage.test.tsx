import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BuildProfilePage from '../src/pages/scoring/BuildProfilePage'

describe('BuildProfilePage', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() { return values.size },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    })
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows Profile ID, Financial Goal, and zero initial completion', () => {
    render(<BuildProfilePage />)

    expect(screen.getByRole('heading', { name: 'Shape Your Financial Future' })).toBeTruthy()
    expect(screen.getByText('Profile ID')).toBeTruthy()
    expect(screen.getByText(/^PRO-[A-Z0-9]{6}$/)).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Financial Goal' })).toBeTruthy()
    expect(screen.getByLabelText('0% profile completion')).toBeTruthy()
  })

  it('calculates completion from entered profile and goal data', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.type(screen.getByLabelText('Full Name'), 'Jordan Santos')
    await user.type(screen.getByLabelText('Email Address'), 'jordan@example.com')
    await user.type(screen.getByLabelText('Mobile Number'), '09171234567')
    await user.type(screen.getByLabelText('Date of Birth'), '1990-01-02')
    await user.type(screen.getByLabelText('Address'), 'Makati City')
    await user.selectOptions(screen.getByLabelText('Employment Status'), 'Employed')
    await user.type(screen.getByLabelText('Occupation'), 'Analyst')
    await user.type(screen.getByLabelText('Gross Monthly Income'), '50000')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Financial Goal' }), 'Build Emergency Fund')
    await user.type(screen.getByLabelText('Target Amount (PHP)'), '250000')
    await user.type(screen.getByLabelText('Target Timeframe (Months)'), '18')

    expect(screen.getByLabelText('100% profile completion')).toBeTruthy()
    expect(screen.getAllByText('Complete').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Save Profile' }))
    expect(screen.getByRole('status').textContent).toBe('Profile saved successfully.')
    expect(window.localStorage.getItem('fms:build-profile')).toContain('Build Emergency Fund')
  })
})
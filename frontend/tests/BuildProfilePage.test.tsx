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

  it('shows the eleven-step profile workflow and initial profile state', () => {
    render(<BuildProfilePage />)

    expect(screen.getByRole('heading', { name: 'Shape Your Financial Future' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Build your Profile' })).toBeTruthy()
    expect(screen.getByText(/^PRO-[A-Z0-9]{6}$/)).toBeTruthy()
    expect(screen.getByLabelText('0% profile completion')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /information provided/ })).toHaveLength(11)
    expect(screen.getByRole('heading', { name: 'Step 1: Tell Us About Yourself' })).toBeTruthy()
  })

  it('navigates through source-derived lending and net worth steps', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.click(screen.getByRole('button', { name: /Applicant Information/ }))
    expect(screen.getByLabelText('Government ID Number')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Goal Setting/ }))
    expect(screen.getByLabelText('Financial Goal / Purpose')).toBeTruthy()
    expect(screen.getByLabelText('Product Being Considered')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Document Upload Center/ }))
    expect(screen.getByText('Choose supporting documents')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Set As Of Date/ }))
    expect(screen.getByRole('combobox', { name: 'Financial Goal' })).toBeTruthy()
    expect(screen.getByLabelText('Target Amount (PHP)')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Suitability Assessment/ }))
    expect(screen.getByText('What is your key investment objective?')).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(20)
  })

  it('tracks step completion and persists profile values', async () => {
    const user = userEvent.setup()
    render(<BuildProfilePage />)

    await user.type(screen.getByLabelText('Full Name'), 'Jordan Santos')
    await user.type(screen.getByLabelText('Email Address'), 'jordan@example.com')
    await user.type(screen.getByLabelText('Mobile Number'), '09171234567')
    await user.type(screen.getByLabelText('Date of Birth'), '1990-01-02')
    await user.type(screen.getByLabelText('Present Address'), 'Makati City')

    expect(screen.getByText('100% complete')).toBeTruthy()
    expect(screen.getByLabelText('9% profile completion')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Set As Of Date/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Financial Goal' }), 'Build Emergency Fund')
    await user.type(screen.getByLabelText('Target Amount (PHP)'), '250000')
    await user.type(screen.getByLabelText('Months to Achieve'), '18')
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    expect(screen.getByRole('status').textContent).toBe('Profile saved successfully.')
    const savedProfile = JSON.parse(window.localStorage.getItem('fms:build-profile') ?? '{}')
    expect(savedProfile.values.financialGoal).toBe('Build Emergency Fund')
    expect(savedProfile.step).toBe(9)
  })
})

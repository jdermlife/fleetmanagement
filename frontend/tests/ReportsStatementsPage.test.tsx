import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({
  hasPaidScoreAccess: true,
  isScoreAccessLoading: false,
}))

vi.mock('../src/hooks/useAuthorization', () => ({
  useAuthorization: () => ({ isAdmin: false }),
}))

vi.mock('../src/hooks/usePaidScoreCertificationAccess', () => ({
  usePaidScoreCertificationAccess: () => access,
}))

import ReportsStatementsPage from '../src/pages/reports/ReportsStatementsPage'

describe('ReportsStatementsPage', () => {
  afterEach(() => {
    cleanup()
    access.hasPaidScoreAccess = true
    access.isScoreAccessLoading = false
  })

  it('groups all existing statements and certificates for paid accounts', () => {
    render(<MemoryRouter><ReportsStatementsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Financial Statements' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Score Certificates' })).toBeTruthy()
    expect(screen.getAllByRole('link')).toHaveLength(6)
    expect(screen.getByRole('button', { name: /Statement of Net Worth/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Balance Sheet/ }).getAttribute('href')).toBe('/financial-health-summary')
    expect(screen.getByRole('link', { name: /Income Statement/ }).getAttribute('href')).toBe('/budget-expense-tracker')
    expect(screen.getByRole('link', { name: /Cash Flow Statement/ }).getAttribute('href')).toBe('/budget-expense-tracker')
    expect(screen.getByRole('link', { name: /Credit Score Certificate/ }).getAttribute('href')).toBe('/lending-scorecard/filscore')
    expect(screen.getByRole('link', { name: /Wealth Protection Score Certificate/ }).getAttribute('href')).toBe('/net-worth-positioning')
    expect(screen.getByRole('link', { name: /Wealth Building Score Certificate/ }).getAttribute('href')).toBe('/net-worth-positioning')
  })

  it('opens and closes the existing assets and liabilities report from Statement of Net Worth', () => {
    render(<MemoryRouter><ReportsStatementsPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /Statement of Net Worth/ }))

    const statement = screen.getByRole('dialog', { name: 'Statement of Assets and Liabilities' })
    expect(statement.querySelectorAll('.admin-statement-sheet')).toHaveLength(4)
    expect(within(statement).getByRole('heading', { name: 'Current Net Worth' })).toBeTruthy()

    fireEvent.click(within(statement).getByRole('button', { name: 'Close financial statement' }))
    expect(screen.queryByRole('dialog', { name: 'Statement of Assets and Liabilities' })).toBeNull()
  })

  it('keeps reports visible but dimmed and non-navigable for non-paid accounts', () => {
    access.hasPaidScoreAccess = false

    render(<MemoryRouter><ReportsStatementsPage /></MemoryRouter>)

    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getAllByText('Paid account required')).toHaveLength(7)
    expect(document.querySelectorAll('.reports-statements-card.is-locked')).toHaveLength(7)
    expect(document.querySelectorAll('[aria-disabled="true"]')).toHaveLength(7)
  })
})
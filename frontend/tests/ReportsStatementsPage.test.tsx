import { cleanup, render, screen } from '@testing-library/react'
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
    expect(screen.getAllByRole('link')).toHaveLength(7)
    expect(screen.getByRole('link', { name: /Statement of Net Worth/ }).getAttribute('href')).toBe('/net-worth-positioning')
    expect(screen.getByRole('link', { name: /Balance Sheet/ }).getAttribute('href')).toBe('/financial-health-summary')
    expect(screen.getByRole('link', { name: /Income Statement/ }).getAttribute('href')).toBe('/budget-expense-tracker')
    expect(screen.getByRole('link', { name: /Cash Flow Statement/ }).getAttribute('href')).toBe('/budget-expense-tracker')
    expect(screen.getByRole('link', { name: /Credit Score Certificate/ }).getAttribute('href')).toBe('/lending-scorecard/filscore')
    expect(screen.getByRole('link', { name: /Wealth Protection Score Certificate/ }).getAttribute('href')).toBe('/net-worth-positioning')
    expect(screen.getByRole('link', { name: /Wealth Building Score Certificate/ }).getAttribute('href')).toBe('/net-worth-positioning')
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
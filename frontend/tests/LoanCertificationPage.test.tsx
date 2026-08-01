import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const { mockFetchLoanApplication, mockRecomputeStoredScores } = vi.hoisted(() => ({
  mockFetchLoanApplication: vi.fn(),
  mockRecomputeStoredScores: vi.fn(),
}))

vi.mock('../src/api/loan', () => ({
  fetchLoanApplication: mockFetchLoanApplication,
  recomputeStoredLoanApplicationScores: mockRecomputeStoredScores,
}))

vi.mock('../src/pages/scoring/applicationCompleteness', () => ({
  calculateInformationProvidedPercent: () => 100,
  CREDIT_RATING_MINIMUM_INFORMATION_PERCENT: 70,
}))

import LoanCertificationPage from '../src/pages/scoring/LoanCertificationPage'

describe('LoanCertificationPage', () => {
  beforeEach(() => {
    mockFetchLoanApplication.mockReset()
    mockRecomputeStoredScores.mockReset()
    mockRecomputeStoredScores.mockResolvedValue({ message: 'computed', quant_scores: {} })
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

  it('uses the persisted final score instead of stale navigation state', async () => {
    mockFetchLoanApplication.mockResolvedValue({
      application_no: 'APP-BUILD-12',
      borrower_name: 'Jordan Santos',
      product_type: 'Auto Loan',
      status: 'CREDIT_REVIEW',
      credit_bureau_reports: {
        bureau_name: 'FILSCORE Credit Bureau Scorecard',
        bureau_score: 91,
      },
      overall_scores: {
        final_score: 80,
        final_grade: 'B+',
        final_rating: 'Very Good',
        final_decision: 'APPROVE',
        credit_score: 78,
        fraud_score: 76,
        social_score: 74,
        psychometric_score: 82,
      },
    })

    render(
      <MemoryRouter
        initialEntries={[{
          pathname: '/loan-certification',
          search: '?applicationNo=APP-BUILD-12',
          state: {
            certificationData: {
              applicationNo: 'APP-BUILD-12',
              borrowerName: 'Stale Applicant',
              productType: 'Auto Loan',
              issuedAt: '2026-01-01T00:00:00.000Z',
              informationProvidedPercent: 100,
              overallScore: 10,
              label: 'Stale',
              decision: 'DECLINE',
              creditScore: 10,
              fraudScore: 10,
              socialScore: 10,
              creditValueScore: 10,
              qrValue: 'stale',
            },
          },
        }]}
      >
        <Routes>
          <Route path="/loan-certification" element={<LoanCertificationPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findAllByText('Jordan Santos')).toHaveLength(2)
    expect(mockRecomputeStoredScores).toHaveBeenCalledWith('APP-BUILD-12')
    expect(mockFetchLoanApplication).toHaveBeenCalledWith('APP-BUILD-12')

    const compositeCard = screen.getByText('Composite Score').closest('div')
    expect(compositeCard).toBeTruthy()
    expect(within(compositeCard!).getByText('760')).toBeTruthy()
    expect(within(compositeCard!).queryByText('270')).toBeNull()
    const bureauCard = screen.getByText('Credit Bureau Score').closest('div')
    expect(bureauCard).toBeTruthy()
    expect(within(bureauCard!).getByText('91 / 100')).toBeTruthy()
    const creditValuesCard = screen.getByText('Credit Values Score').closest('div')
    expect(creditValuesCard).toBeTruthy()
    expect(creditValuesCard?.classList.contains('loan-certification-metric-card-credit-values')).toBe(true)
    expect(screen.queryByText('ORM/KYC Score')).toBeNull()
    expect(screen.queryByText('AML Score: NA')).toBeNull()
    expect(screen.queryByText('DB Not Available')).toBeNull()
  })

  it('loads the borrower and score from the selected Profile ID when the URL has no application number', async () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'APP-SELECTED-9',
      selectedApplicationNo: 'APP-SELECTED-9',
      values: {},
      documents: [],
      suitabilityAnswers: {},
      coBorrowers: [],
      guarantors: [],
      additionalCollaterals: [],
    }))
    mockFetchLoanApplication.mockResolvedValue({
      application_no: 'APP-SELECTED-9',
      borrower_name: 'Maria Reyes',
      product_type: 'Personal Loan',
      status: 'APPROVED',
      credit_bureau_reports: {
        bureau_name: 'FILSCORE Credit Bureau Scorecard',
        bureau_score: 88,
      },
      overall_scores: {
        final_score: 90,
        final_grade: 'A',
        final_rating: 'Excellent',
        final_decision: 'APPROVE',
        credit_score: 89,
        fraud_score: 87,
        social_score: 86,
        psychometric_score: 91,
      },
    })

    render(
      <MemoryRouter initialEntries={['/loan-certification']}>
        <Routes>
          <Route path="/loan-certification" element={<LoanCertificationPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findAllByText('Maria Reyes')).toHaveLength(2)
    expect(mockRecomputeStoredScores).toHaveBeenCalledWith('APP-SELECTED-9')
    expect(mockFetchLoanApplication).toHaveBeenCalledWith('APP-SELECTED-9')
    const compositeCard = screen.getByText('Composite Score').closest('div')
    expect(compositeCard).toBeTruthy()
    expect(within(compositeCard!).getByText('830')).toBeTruthy()
  })
})
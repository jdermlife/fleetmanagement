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
  })

  afterEach(() => {
    cleanup()
  })

  it('uses the persisted final score instead of stale navigation state', async () => {
    mockFetchLoanApplication.mockResolvedValue({
      application_no: 'APP-BUILD-12',
      borrower_name: 'Jordan Santos',
      product_type: 'Auto Loan',
      status: 'CREDIT_REVIEW',
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
  })
})
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LoanOptimizationTachometer, { computeLoanOptimizationOpportunity } from '../src/pages/scoring/LoanOptimizationTachometer';

describe('LoanOptimizationTachometer', () => {
  it('calculates an equal-weight opportunity from the three optimization results', () => {
    expect(computeLoanOptimizationOpportunity({
      prioritizedLoanSavingsPercent: 20,
      cashOptimizationScore: 80,
      collateralOptimizationScore: 50,
    })).toMatchObject({
      opportunityPercent: 50,
      interpretation: 'Moderate optimization potential',
    });
  });

  it('renders the composite and each contributing result', () => {
    render(<LoanOptimizationTachometer input={{
      prioritizedLoanSavingsPercent: 20,
      cashOptimizationScore: 80,
      collateralOptimizationScore: 50,
    }} />);

    expect(screen.getByRole('meter', { name: /Loan Optimization Opportunity: 50.0%/ })).toBeTruthy();
    expect(screen.getByText('Prioritized Loan Savings')).toBeTruthy();
    expect(screen.getByText('Cash Optimization')).toBeTruthy();
    expect(screen.getByText('Collateral Optimization')).toBeTruthy();
  });
});
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import DebtBalanceStackedChart, { buildDebtBalanceChart } from '../src/pages/scoring/DebtBalanceStackedChart';

const accounts = [
  {
    id: 'home-loan',
    label: 'Home Loan',
    balances: [
      { monthLabel: 'Jan 2026', endBalance: 800_000 },
      { monthLabel: 'Feb 2026', endBalance: 780_000 },
    ],
  },
  {
    id: 'credit-card',
    label: 'Credit Card',
    balances: [
      { monthLabel: 'Jan 2026', endBalance: 100_000 },
      { monthLabel: 'Feb 2026', endBalance: 80_000 },
    ],
  },
];

describe('DebtBalanceStackedChart', () => {
  it('totals each month while retaining one segment per account', () => {
    const chart = buildDebtBalanceChart(accounts);

    expect(chart.months[0]).toMatchObject({ monthLabel: 'Jan 2026', total: 900_000 });
    expect(chart.months[0].segments.map((segment) => segment.label)).toEqual(['Home Loan', 'Credit Card']);
    expect(chart.months[1].total).toBe(860_000);
  });

  it('renders monthly bars and account legend accessibly', () => {
    render(<DebtBalanceStackedChart accounts={accounts} />);

    expect(screen.getByRole('img', { name: /2 months and 2 accounts/ })).toBeTruthy();
    expect(screen.getByLabelText('Jan 2026: ₱900K total debt')).toBeTruthy();
    expect(screen.getByText('Home Loan')).toBeTruthy();
    expect(screen.getByText('Credit Card')).toBeTruthy();
  });
});
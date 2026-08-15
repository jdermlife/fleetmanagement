import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BillDueDateHeatMap, { billDueUrgency, buildBillDueDateHeatMap } from '../src/pages/scoring/BillDueDateHeatMap';

const referenceDate = new Date(2026, 7, 15);
const bills = [
  { id: 'green', company: 'Green Energy', utilityType: 'Electricity', estimatedDueDay: '27', dateCovered: '' },
  { id: 'amber', company: 'Amber Water', utilityType: 'Water', estimatedDueDay: '24', dateCovered: '' },
  { id: 'red', company: 'Red Internet', utilityType: 'Internet', estimatedDueDay: '17', dateCovered: '' },
  { id: 'overdue', company: 'Past Due Loan', utilityType: 'Loan', estimatedDueDay: '10', dateCovered: '' },
];

describe('BillDueDateHeatMap', () => {
  it('applies green, amber, and red timing thresholds', () => {
    expect(billDueUrgency(12)).toBe('green');
    expect(billDueUrgency(10)).toBe('green');
    expect(billDueUrgency(9)).toBe('amber');
    expect(billDueUrgency(3)).toBe('amber');
    expect(billDueUrgency(2)).toBe('red');
    expect(billDueUrgency(-5)).toBe('red');
  });

  it('places bills on their due dates in the current calendar month', () => {
    const calendar = buildBillDueDateHeatMap(bills, referenceDate);
    expect(calendar.cells.find((cell) => cell?.day === 27)?.bills[0].urgency).toBe('green');
    expect(calendar.cells.find((cell) => cell?.day === 24)?.bills[0].urgency).toBe('amber');
    expect(calendar.cells.find((cell) => cell?.day === 17)?.bills[0].urgency).toBe('red');
  });

  it('renders bill timing signals accessibly', () => {
    render(<BillDueDateHeatMap bills={bills} referenceDate={referenceDate} />);
    expect(screen.getByRole('grid', { name: /August 2026 bill due dates/ })).toBeTruthy();
    expect(screen.getByLabelText('Green Energy, Electricity, 12 days remaining')).toBeTruthy();
    expect(screen.getByLabelText('Past Due Loan, Loan, 5 days overdue')).toBeTruthy();
  });
});
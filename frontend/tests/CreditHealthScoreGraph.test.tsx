import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CreditHealthScoreGraph from '../src/pages/scoring/CreditHealthScoreGraph';

describe('CreditHealthScoreGraph', () => {
  afterEach(() => cleanup());

  it('renders four separate score rings with left-side indicators', () => {
    const { container } = render(
      <CreditHealthScoreGraph
        scores={{ credit: 810, nonStarter: 690, social: 745, psychometric: 780 }}
      />,
    );

    expect(container.querySelectorAll('[data-score-ring]')).toHaveLength(4);
    expect(container.querySelector('[data-score-ring="credit"]')).toBeTruthy();
    expect(container.querySelector('[data-score-ring="nonStarter"]')).toBeTruthy();
    expect(container.querySelector('[data-score-ring="social"]')).toBeTruthy();
    expect(container.querySelector('[data-score-ring="psychometric"]')).toBeTruthy();
    expect(screen.getByLabelText('Credit Health score indicators')).toBeTruthy();
    expect(screen.getByText('810')).toBeTruthy();
    expect(screen.getByText('690')).toBeTruthy();
    expect(screen.getByText('745')).toBeTruthy();
    expect(screen.getByText('780')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Credit Score: 810, Non-Starter Score: 690, Social Score: 745, Psychometric Score: 780',
    );
  });

  it('shows pending values in the left-side indicators', () => {
    render(
      <CreditHealthScoreGraph
        scores={{ credit: null, nonStarter: null, social: null, psychometric: null }}
      />,
    );

    expect(screen.getAllByText('Pending')).toHaveLength(4);
    expect(screen.getByText('Credit Score')).toBeTruthy();
    expect(screen.getByText('Psychometric Score')).toBeTruthy();
    expect(screen.getByText('Social Score')).toBeTruthy();
    expect(screen.getByText('Non-Starter Score')).toBeTruthy();
  });
});
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CreditHealthScoreGraph from '../src/pages/scoring/CreditHealthScoreGraph';

describe('CreditHealthScoreGraph', () => {
  afterEach(() => cleanup());

  it('renders four separate score regions with their assigned values', () => {
    const { container } = render(
      <CreditHealthScoreGraph
        scores={{ credit: 810, nonStarter: 690, social: 745, psychometric: 780 }}
      />,
    );

    expect(container.querySelectorAll('[data-score-region]')).toHaveLength(4);
    expect(container.querySelector('[data-score-region="credit"]')).toBeTruthy();
    expect(container.querySelector('[data-score-region="nonStarter"]')).toBeTruthy();
    expect(container.querySelector('[data-score-region="social"]')).toBeTruthy();
    expect(container.querySelector('[data-score-region="psychometric"]')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Credit Score: 810, Psychometric Score: 780, Social Score: 745, Non-Starter Score: 690',
    );
  });

  it('keeps pending scores inside their own graph regions', () => {
    render(
      <CreditHealthScoreGraph
        scores={{ credit: null, nonStarter: null, social: null, psychometric: null }}
      />,
    );

    expect(screen.getAllByText('Pending')).toHaveLength(4);
    expect(screen.getByText('Credit Score')).toBeTruthy();
    expect(screen.getByText('Psychometric')).toBeTruthy();
    expect(screen.getByText('Social Score')).toBeTruthy();
    expect(screen.getByText('Non-Starter')).toBeTruthy();
  });
});
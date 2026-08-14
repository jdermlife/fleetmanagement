import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import WealthBalanceRadar from '../src/pages/scoring/WealthBalanceRadar';

describe('WealthBalanceRadar', () => {
  it('renders four colored axes with left-side indicators and native scores', () => {
    const { container } = render(
      <WealthBalanceRadar
        netWorthPositioning={760}
        wealthBehaviour={82}
        wealthFoundation={740}
        wealthAuthenticity={91}
      />,
    );

    expect(container.querySelectorAll('[data-radar-axis]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-radar-point]')).toHaveLength(4);
    expect(container.querySelector('[data-radar-score]')).toBeTruthy();
    expect(container.querySelector('[data-radar-axis="positioning"]')?.getAttribute('style')).toContain('rgb(22, 101, 52)');
    expect(container.querySelector('[data-radar-axis="behaviour"]')?.getAttribute('style')).toContain('rgb(212, 167, 44)');
    expect(container.querySelector('[data-radar-axis="foundation"]')?.getAttribute('style')).toContain('rgb(30, 58, 138)');
    expect(container.querySelector('[data-radar-axis="authenticity"]')?.getAttribute('style')).toContain('rgb(248, 250, 252)');
    expect(container.querySelector('[data-radar-axis="positioning"]')?.getAttribute('x2')).toBe('100');
    expect(container.querySelector('[data-radar-axis="positioning"]')?.getAttribute('y2')).toBe('24');
    expect(container.querySelector('[data-radar-axis="behaviour"]')?.getAttribute('x2')).toBe('176');
    expect(container.querySelector('[data-radar-axis="behaviour"]')?.getAttribute('y2')).toBe('100');
    expect(screen.getByText('Net Worth Positioning')).toBeTruthy();
    expect(screen.getByText('Wealth Behaviour')).toBeTruthy();
    expect(screen.getByText('Wealth Foundation')).toBeTruthy();
    expect(screen.getByText('Wealth Authenticity')).toBeTruthy();
    expect(screen.getByText('760')).toBeTruthy();
    expect(screen.getByText('82')).toBeTruthy();
    expect(screen.getByText('740')).toBeTruthy();
    expect(screen.getByText('91')).toBeTruthy();
    expect(screen.getByRole('img', {
      name: 'Net Worth Positioning: 80 out of 100 normalized, Wealth Behaviour: 82 out of 100 normalized, Wealth Foundation: 74 out of 100 normalized, Wealth Authenticity: 91 out of 100 normalized',
    })).toBeTruthy();
  });
});
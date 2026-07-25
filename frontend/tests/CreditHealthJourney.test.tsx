import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import CreditHealthJourney, {
  CREDIT_HEALTH_COMPONENTS,
  CREDIT_HEALTH_STEPS,
} from '../src/pages/scoring/CreditHealthJourney'

function installLocalStorageStub() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  }

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

describe('CreditHealthJourney', () => {
  beforeEach(() => installLocalStorageStub())
  afterEach(() => cleanup())

  it('explains the three Credit Health components and Steps 1 through 8', () => {
    render(<CreditHealthJourney />)

    expect(screen.getByRole('dialog', { name: 'Assess your Credit Health' })).toBeTruthy()
    expect(screen.getByText(/Credit Health brings together three complementary views/)).toBeTruthy()

    CREDIT_HEALTH_COMPONENTS.forEach((component) => {
      expect(screen.getByRole('heading', { name: component.title })).toBeTruthy()
      expect(screen.getByText(component.description)).toBeTruthy()
    })

    CREDIT_HEALTH_STEPS.forEach((journeyStep) => {
      expect(
        screen.getByRole('heading', {
          name: `Step ${journeyStep.number}: ${journeyStep.title}`,
        }),
      ).toBeTruthy()
      expect(screen.getByText(journeyStep.description)).toBeTruthy()
    })
  })

  it('minimizes into a persistent button and can be reopened', () => {
    render(<CreditHealthJourney />)

    fireEvent.click(screen.getByRole('button', { name: 'Minimize Assess your Credit Health' }))

    expect(screen.queryByRole('dialog', { name: 'Assess your Credit Health' })).toBeNull()
    expect(window.localStorage.getItem('fms:credit-health-journey:minimized')).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: 'Assess your Credit Health' }))

    expect(screen.getByRole('dialog', { name: 'Assess your Credit Health' })).toBeTruthy()
    expect(window.localStorage.getItem('fms:credit-health-journey:minimized')).toBeNull()
  })

  it('honors the do-not-show preference after continuing', () => {
    const { unmount } = render(<CreditHealthJourney />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Do not show this Credit Health pop-up again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Credit Health' }))

    expect(screen.queryByRole('dialog', { name: 'Assess your Credit Health' })).toBeNull()
    expect(window.localStorage.getItem('fms:credit-health-journey:do-not-show')).toBe('1')

    unmount()
    render(<CreditHealthJourney />)

    expect(screen.queryByRole('dialog', { name: 'Assess your Credit Health' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Assess your Credit Health' })).toBeNull()
  })
})
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import NetWorthJourney, {
  WEALTH_BUILDING_COMPONENTS,
  WEALTH_MANAGEMENT_TOOLS,
} from '../src/pages/scoring/NetWorthJourney'

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

describe('NetWorthJourney', () => {
  beforeEach(() => installLocalStorageStub())
  afterEach(() => cleanup())

  it('explains the Wealth Building components and links to resource-management tools', () => {
    render(<NetWorthJourney />)

    expect(screen.getByRole('dialog', { name: 'Improve your Net Worth' })).toBeTruthy()
    expect(screen.getByText(/Your Wealth Building Score brings together four views/)).toBeTruthy()

    WEALTH_BUILDING_COMPONENTS.forEach((component) => {
      expect(screen.getByRole('heading', { name: component.title })).toBeTruthy()
      expect(screen.getByText(component.description)).toBeTruthy()
    })

    expect(screen.getByRole('heading', { name: 'Manage your resources well' })).toBeTruthy()
    WEALTH_MANAGEMENT_TOOLS.forEach((tool) => {
      expect(screen.getByRole('heading', { name: tool.title })).toBeTruthy()
      expect(screen.getByText(tool.description)).toBeTruthy()
      expect(screen.getByRole('link', { name: tool.actionLabel }).getAttribute('href')).toBe(tool.route)
    })
  })

  it('minimizes into a persistent button and can be reopened', () => {
    render(<NetWorthJourney />)

    fireEvent.click(screen.getByRole('button', { name: 'Minimize Improve your Net Worth' }))

    expect(screen.queryByRole('dialog', { name: 'Improve your Net Worth' })).toBeNull()
    expect(window.localStorage.getItem('fms:net-worth-journey:minimized')).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: 'Improve your Net Worth' }))

    expect(screen.getByRole('dialog', { name: 'Improve your Net Worth' })).toBeTruthy()
    expect(window.localStorage.getItem('fms:net-worth-journey:minimized')).toBeNull()
  })

  it('honors the do-not-show preference after continuing', () => {
    const { unmount } = render(<NetWorthJourney />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Do not show this Net Worth pop-up again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Net Worth Positioning' }))

    expect(screen.queryByRole('dialog', { name: 'Improve your Net Worth' })).toBeNull()
    expect(window.localStorage.getItem('fms:net-worth-journey:do-not-show')).toBe('1')

    unmount()
    render(<NetWorthJourney />)

    expect(screen.queryByRole('dialog', { name: 'Improve your Net Worth' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Improve your Net Worth' })).toBeNull()
  })
})
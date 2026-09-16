import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { saveNow } = vi.hoisted(() => ({
  saveNow: vi.fn<() => Promise<boolean>>(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

vi.mock('../src/hooks/useAuthorization', () => ({
  useAuthorization: () => ({
    isAdmin: false,
    isAuthenticated: true,
    isLoading: false,
  }),
}))

vi.mock('../src/autosave', () => ({
  useAutosaveDraft: () => ({
    isHydrated: true,
    status: {
      scope: 'build-profile',
      entityKey: 'current',
      state: 'saved',
    },
    clear: vi.fn(),
    saveNow,
  }),
}))

vi.mock('../src/api/loan', () => ({
  fetchLoanApplication: vi.fn(),
  updateLoanApplication: vi.fn(),
}))

import BuildProfilePage from '../src/pages/scoring/BuildProfilePage'

describe('BuildProfilePage manual save', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        get length() { return values.size },
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
    window.localStorage.setItem('fms:journey:do-not-show', '1')
  })

  afterEach(() => {
    cleanup()
    saveNow.mockReset()
  })

  it('shows saving progress and confirms the Loan Applications database save', async () => {
    let completeSave: ((saved: boolean) => void) | undefined
    saveNow.mockReturnValue(new Promise<boolean>((resolve) => {
      completeSave = resolve
    }))
    const user = userEvent.setup()

    render(<BuildProfilePage />)
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    const savingButton = screen.getByText('Saving...').closest('button')
    expect(savingButton?.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('Saving profile...')

    await act(async () => {
      completeSave?.(true)
    })

    const savedButton = await screen.findByRole('button', { name: 'Save Profile' })
    expect(savedButton.hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('status').textContent).toMatch(
      /Saved\. Profile PRO-[A-Z0-9]{6} is synchronized in Profile Setup\./,
    )
    expect(saveNow).toHaveBeenCalledTimes(1)
  })

  it('does not claim a database save when synchronization fails', async () => {
    saveNow.mockResolvedValue(false)
    const user = userEvent.setup()

    render(<BuildProfilePage />)
    await user.click(screen.getByRole('button', { name: 'Save Profile' }))

    expect(screen.getByRole('status').textContent).toContain(
      'Profile saved on this device, but database synchronization failed. Please try again.',
    )
  })
})

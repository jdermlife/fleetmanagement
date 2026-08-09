import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import AuthProgressOverlay from '../src/components/auth/AuthProgressOverlay'

describe('AuthProgressOverlay', () => {
  afterEach(() => {
    cleanup()
  })

  it('announces the active operation and exposes an indeterminate progress indicator', () => {
    render(
      <AuthProgressOverlay
        idPrefix="test-upload"
        kicker="Secure access"
        title="Signing you in"
        orbitLabels={['Financial Health', 'Credit Worthy', 'Networth Growth']}
        description="Verifying your account and preparing your dashboard."
        footnote="Please keep this window open."
      />,
    )

    const overlay = screen.getByRole('dialog', { name: 'Signing you in' })
    expect(overlay.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('progressbar', { name: 'Signing you in in progress' })).toBeTruthy()
    expect(screen.getByText('Verifying your account and preparing your dashboard.')).toBeTruthy()
    expect(screen.getByText('Financial Health')).toBeTruthy()
    expect(screen.getByText('Credit Worthy')).toBeTruthy()
    expect(screen.getByText('Networth Growth')).toBeTruthy()
  })
})

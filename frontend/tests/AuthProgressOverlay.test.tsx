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
        kicker="Record repository"
        title="Uploading your records"
        description="Validating and importing the selected file."
        footnote="Please keep this window open."
      />,
    )

    const overlay = screen.getByRole('dialog', { name: 'Uploading your records' })
    expect(overlay.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('progressbar', { name: 'Uploading your records in progress' })).toBeTruthy()
    expect(screen.getByText('Validating and importing the selected file.')).toBeTruthy()
  })
})

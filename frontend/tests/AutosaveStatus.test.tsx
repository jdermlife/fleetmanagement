import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'

import { emitAutosaveStatus } from '../src/autosave/autosaveStatus'
import AutosaveStatus from '../src/components/AutosaveStatus'

describe('AutosaveStatus', () => {
  it('announces matching shared autosave events and ignores other scopes', () => {
    render(<AutosaveStatus scope="vehicle" entityKey="new" />)

    act(() => {
      emitAutosaveStatus({
        scope: 'driver',
        entityKey: 'new',
        state: 'saving',
      })
    })
    expect(screen.queryByRole('status')).toBeNull()

    act(() => {
      emitAutosaveStatus({
        scope: 'vehicle',
        entityKey: 'new',
        state: 'saved',
        source: 'remote',
      })
    })

    expect(screen.getByRole('status').textContent).toBe('All changes saved')
    expect(screen.getByRole('status').getAttribute('data-autosave-state')).toBe('saved')
  })
})

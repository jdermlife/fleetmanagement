import { describe, expect, it } from 'vitest'

import { initializeStep9DesiredTargets, STEP_9_EDITED_PREFIX } from '../src/pages/scoring/buildProfileStep9'

describe('initializeStep9DesiredTargets', () => {
  it('copies Step 8 values over preinitialized target zeroes', () => {
    const values = initializeStep9DesiredTargets({ cash: '25000', 'wealthActual.cash': '0', asOfDate: '2026-09-29' }, ['cash'])

    expect(values['wealthActual.cash']).toBe('25000')
    expect(values.wealthActualAsOfDate).toBe('2026-09-29')
  })

  it('preserves target values changed in Step 9', () => {
    const values = initializeStep9DesiredTargets({
      cash: '25000',
      'wealthActual.cash': '40000',
      [`${STEP_9_EDITED_PREFIX}cash`]: 'true',
    }, ['cash'])

    expect(values['wealthActual.cash']).toBe('40000')
  })

  it('preserves a nonzero target saved before edit markers were introduced', () => {
    const values = initializeStep9DesiredTargets({ cash: '25000', 'wealthActual.cash': '50000' }, ['cash'])

    expect(values['wealthActual.cash']).toBe('50000')
  })

  it('preserves a saved Step 9 target statement', () => {
    const original = { cash: '25000', 'wealthActual.cash': '50000', wealthSetupSaved: 'true' }

    expect(initializeStep9DesiredTargets(original, ['cash'])).toBe(original)
  })
})
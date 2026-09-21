import { describe, expect, it } from 'vitest'

import { buildLoanMonitoringSnapshot } from '../src/pages/scoring/liveTrackerMetrics'

describe('buildLoanMonitoringSnapshot', () => {
  it('treats zero past dues as healthy while incomplete application readiness needs attention', () => {
    const snapshot = buildLoanMonitoringSnapshot([])

    expect(snapshot.controlItems.find((item) => item.id === 'data-completeness')).toMatchObject({
      actual: 0,
      target: 100,
      status: 'attention',
    })
    expect(snapshot.controlItems.find((item) => item.id === 'past-due-control')).toMatchObject({
      actual: 0,
      target: 0,
      attainment: 100,
      status: 'maintain',
    })
  })
})
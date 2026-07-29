import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveSelectedProfileId } from '../src/components/profile/SelectedProfileIdCard'
import { resolveSelectedApplicationNo } from '../src/hooks/useSelectedAnalysisEntity'

describe('selected profile identity', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
  })

  it('uses the repository-selected application number before other profile identities', () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-LOCAL',
      values: {},
    }))

    expect(resolveSelectedProfileId(new URLSearchParams(
      'applicationNo=APP-SELECTED&profileId=PRO-QUERY',
    ))).toBe('APP-SELECTED')
  })

  it('uses the persisted Build Profile ID when the URL has no profile selection', () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-LOCAL',
      values: {},
    }))

    expect(resolveSelectedProfileId(new URLSearchParams())).toBe('PRO-LOCAL')
  })

  it('uses only an actual application selection for report analysis', () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-LOCAL',
      selectedApplicationNo: 'APP-ANALYSIS',
      values: {},
    }))

    expect(resolveSelectedApplicationNo(new URLSearchParams())).toBe('APP-ANALYSIS')
    expect(resolveSelectedApplicationNo(new URLSearchParams('applicationNo=APP-QUERY'))).toBe('APP-QUERY')
  })
})
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApplicationRegisterCsv, downloadApplicationRegisterCsv } from '../src/pages/scoring/loanRepositoryCsv'

describe('downloadApplicationRegisterCsv', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('clicks the download before revoking its object URL', () => {
    vi.useFakeTimers()
    const createObjectUrl = vi.fn(() => 'blob:application-register')
    const revokeObjectUrl = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl })

    downloadApplicationRegisterCsv(new Blob(['application_no\nAPP-001'], { type: 'text/csv' }), 'application-register.csv')

    const link = document.querySelector('a[download="application-register.csv"]')
    expect(link).toBeTruthy()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(document.querySelector('a[download="application-register.csv"]')).toBeNull()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:application-register')
  })

  it('creates a text-only application register with escaped values', () => {
    const csv = createApplicationRegisterCsv([{
      application_no: 'APP-001',
      borrower_name: 'Dela Cruz, Juan',
      committee_remarks: 'He said "review"',
      email: '=unsafe@example.com',
      status: 'Draft',
    } as never])

    expect(csv).toContain('"Application No"')
    expect(csv).toContain('"Dela Cruz, Juan"')
    expect(csv).toContain('"He said ""review"""')
    expect(csv).toContain("\"'=unsafe@example.com\"")
  })
})
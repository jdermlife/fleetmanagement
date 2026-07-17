import { afterEach, describe, expect, it, vi } from 'vitest'

describe('loadPayPalSdk', () => {
  afterEach(() => {
    document.getElementById('paypal-js-sdk')?.remove()
    delete window.paypal
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('replaces an existing SDK script when the checkout currency changes', async () => {
    const oldScript = document.createElement('script')
    oldScript.id = 'paypal-js-sdk'
    oldScript.src = 'https://www.paypal.com/sdk/js?client-id=test-client&components=buttons&currency=USD&intent=capture'
    document.body.appendChild(oldScript)
    window.paypal = {
      Buttons: vi.fn(() => ({ render: vi.fn() })),
    }

    const replacementButtons = vi.fn(() => ({ render: vi.fn() }))
    const appendChild = document.body.appendChild.bind(document.body)
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      const appendedNode = appendChild(node)
      if (node instanceof HTMLScriptElement && node.id === 'paypal-js-sdk') {
        window.paypal = { Buttons: replacementButtons }
        node.onload?.(new Event('load'))
      }
      return appendedNode
    })

    const { loadPayPalSdk } = await import('../src/paypalSdk')
    const paypal = await loadPayPalSdk('test-client', 'PHP')
    const activeScript = document.getElementById('paypal-js-sdk') as HTMLScriptElement

    expect(oldScript.isConnected).toBe(false)
    expect(activeScript.src).toContain('currency=PHP')
    expect(paypal.Buttons).toBe(replacementButtons)
  })
})

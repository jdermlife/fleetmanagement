import { describe, expect, it, vi } from 'vitest'

import { requestAppleSignInToken } from '../src/appleAuth'

describe('requestAppleSignInToken', () => {
  it('initializes Apple SDK and returns id token', async () => {
    const init = vi.fn()
    const signIn = vi.fn().mockResolvedValue({
      authorization: {
        id_token: 'apple-id-token-value',
      },
    })

    window.AppleID = {
      auth: {
        init,
        signIn,
      },
    }

    const result = await requestAppleSignInToken({
      clientId: 'com.quantech.filscore.web',
      redirectURI: 'https://fleet.quantech.international/api/auth/apple/callback',
    })

    expect(init).toHaveBeenCalledWith({
      clientId: 'com.quantech.filscore.web',
      scope: 'name email',
      redirectURI: 'https://fleet.quantech.international/api/auth/apple/callback',
      usePopup: true,
      responseType: 'code id_token',
      responseMode: 'fragment',
    })
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ idToken: 'apple-id-token-value' })
  })

  it('throws when Apple SDK is unavailable', async () => {
    window.AppleID = undefined

    await expect(
      requestAppleSignInToken({ clientId: 'com.quantech.filscore.web' })
    ).rejects.toThrow('Apple Sign-In is not available right now.')
  })
})

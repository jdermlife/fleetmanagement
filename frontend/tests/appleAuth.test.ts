import { describe, expect, it, vi } from 'vitest'

import { requestAppleSignInToken } from '../src/appleAuth'

describe('requestAppleSignInToken', () => {
  it('initializes Apple SDK and returns id token', async () => {
    let initializedState = ''
    const init = vi.fn((config: { state: string }) => {
      initializedState = config.state
    })
    const signIn = vi.fn().mockImplementation(async () => ({
      authorization: {
        id_token: 'apple-id-token-value',
        state: initializedState,
      },
    }))

    window.AppleID = {
      auth: {
        init,
        signIn,
      },
    }

    const result = await requestAppleSignInToken({
      clientId: 'com.quantech.filscore.web',
      redirectURI: 'https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback',
    })

    expect(init).toHaveBeenCalledWith({
      clientId: 'com.quantech.filscore.web',
      scope: 'name email',
      redirectURI: 'https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback',
      state: expect.any(String),
      usePopup: true,
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

  it('rejects an Apple response with a mismatched authorization state', async () => {
    window.AppleID = {
      auth: {
        init: vi.fn(),
        signIn: vi.fn().mockResolvedValue({
          authorization: {
            id_token: 'apple-id-token-value',
            state: 'unexpected-state',
          },
        }),
      },
    }

    await expect(
      requestAppleSignInToken({
        clientId: 'com.quantech.filscore.web',
        redirectURI: 'https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback',
      })
    ).rejects.toThrow('invalid authorization state')
  })
})

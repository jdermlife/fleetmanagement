import { describe, expect, it, vi } from 'vitest'

const capacitorMocks = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'web'),
  isNativePlatform: vi.fn(() => false),
}))
const socialLoginMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  login: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: capacitorMocks }))
vi.mock('@capgo/capacitor-social-login', () => ({ SocialLogin: socialLoginMocks }))

import { requestAppleSignInToken } from '../src/appleAuth'

describe('requestAppleSignInToken', () => {
  it('initializes the native iOS provider and returns its identity token', async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true)
    capacitorMocks.getPlatform.mockReturnValue('ios')
    socialLoginMocks.initialize.mockResolvedValue(undefined)
    socialLoginMocks.login.mockResolvedValue({
      provider: 'apple',
      result: { idToken: 'native-apple-id-token' },
    })

    const result = await requestAppleSignInToken({
      clientId: 'com.quantech.filscore.web',
      iosClientId: 'com.fms.mobile',
      redirectURI: 'https://unused-in-native.example/auth/apple/callback',
    })

    expect(socialLoginMocks.initialize).toHaveBeenCalledWith({
      apple: { clientId: 'com.fms.mobile' },
    })
    expect(socialLoginMocks.login).toHaveBeenCalledWith({
      provider: 'apple',
      options: { scopes: ['email', 'name'] },
    })
    expect(result).toEqual({ idToken: 'native-apple-id-token' })

    capacitorMocks.isNativePlatform.mockReturnValue(false)
    capacitorMocks.getPlatform.mockReturnValue('web')
  })

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

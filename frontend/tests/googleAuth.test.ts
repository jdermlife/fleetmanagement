import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockInitialize, mockLogin } = vi.hoisted(() => ({
  mockInitialize: vi.fn(),
  mockLogin: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
  },
}))

vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: {
    initialize: mockInitialize,
    login: mockLogin,
  },
}))

import { requestGoogleSignInToken } from '../src/googleAuth'

describe('native Google authentication', () => {
  beforeEach(() => {
    mockInitialize.mockReset()
    mockInitialize.mockResolvedValue(undefined)
    mockLogin.mockReset()
    mockLogin.mockResolvedValue({
      provider: 'google',
      result: {
        responseType: 'online',
        idToken: 'native-google-id-token',
        accessToken: null,
        profile: {},
      },
    })
  })

  it('initializes native Google once and returns an ID token', async () => {
    await expect(requestGoogleSignInToken('web-client-id')).resolves.toBe('native-google-id-token')
    await expect(requestGoogleSignInToken('web-client-id')).resolves.toBe('native-google-id-token')

    expect(mockInitialize).toHaveBeenCalledTimes(1)
    expect(mockInitialize).toHaveBeenCalledWith({
      google: {
        webClientId: 'web-client-id',
        mode: 'online',
      },
    })
    expect(mockLogin).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: ['email', 'profile'],
        filterByAuthorizedAccounts: false,
      },
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetPlatform, mockInitialize, mockLogin } = vi.hoisted(() => ({
  mockGetPlatform: vi.fn(() => 'ios'),
  mockInitialize: vi.fn(),
  mockLogin: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: mockGetPlatform,
    isNativePlatform: () => true,
  },
}))

vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: {
    initialize: mockInitialize,
    login: mockLogin,
  },
}))

import {
  getNativeGooglePlatform,
  initializeNativeGoogleSignIn,
  requestGoogleSignInToken,
} from '../src/googleAuth'

describe('native Google authentication', () => {
  beforeEach(() => {
    mockGetPlatform.mockReset()
    mockGetPlatform.mockReturnValue('ios')
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

  it('reports the actual native platform', () => {
    expect(getNativeGooglePlatform()).toBe('ios')

    mockGetPlatform.mockReturnValue('android')
    expect(getNativeGooglePlatform()).toBe('android')
  })

  it('initializes native Google once and returns an ID token', async () => {
    await expect(initializeNativeGoogleSignIn('web-client-id', 'ios-client-id')).resolves.toBeUndefined()
    await expect(requestGoogleSignInToken('web-client-id', 'ios-client-id')).resolves.toBe('native-google-id-token')
    await expect(requestGoogleSignInToken('web-client-id', 'ios-client-id')).resolves.toBe('native-google-id-token')

    expect(mockInitialize).toHaveBeenCalledTimes(1)
    expect(mockInitialize).toHaveBeenCalledWith({
      google: {
        webClientId: 'web-client-id',
        iOSClientId: 'ios-client-id',
        mode: 'online',
      },
    })
    expect(mockLogin).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        filterByAuthorizedAccounts: false,
      },
    })
  })
})

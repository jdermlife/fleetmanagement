import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'

export interface AppleSignInResult {
  idToken: string
}

let nativeInitializationRequest: Promise<void> | null = null

const ANDROID_APPLE_CLIENT_ID = 'com.quantech.filscore.web'

const ANDROID_APPLE_REDIRECT =
  'https://fleetmanagement-dq9t.onrender.com/api/auth/apple/callback'

type AppleAuthInitConfig = {
  clientId: string
  scope: string
  redirectURI?: string
  state: string
  usePopup: boolean
}

type AppleAuthSignInResponse = {
  authorization?: {
    id_token?: string
    state?: string
  }
  error?: string
  error_description?: string
}

type AppleAuthApi = {
  init(config: AppleAuthInitConfig): void
  signIn(): Promise<AppleAuthSignInResponse>
}

declare global {
  interface Window {
    AppleID?: {
      auth?: AppleAuthApi
    }
  }
}

export function isAppleSignInReady(): boolean {
  return Capacitor.isNativePlatform() || Boolean(window.AppleID?.auth)
}

export function isNativeAppleSignIn(): boolean {
  return Capacitor.isNativePlatform()
}

async function requestNativeAppleSignInToken(
  clientId: string,
  redirectUrl?: string,
): Promise<AppleSignInResult> {

  if (!nativeInitializationRequest) {
    console.log('[AppleAuth] Initializing Apple Sign-In')

    nativeInitializationRequest = SocialLogin.initialize({
      apple: {
        clientId,
        ...(redirectUrl
          ? {
              redirectUrl,
              useProperTokenExchange: true,
              useBroadcastChannel: false,
            }
          : {}),
      },
    })
      .then(() => {
        console.log('[AppleAuth] Apple initialization succeeded')
      })
      .catch((error) => {
        console.error(
          '[AppleAuth] Apple initialization FAILED:',
          error,
        )

        nativeInitializationRequest = null
        throw error
      })
  }

  await nativeInitializationRequest

  console.log('[AppleAuth] Calling Apple Sign-In')

  const response = await SocialLogin.login({
    provider: 'apple',
    options: {
      scopes: ['email', 'name'],
    },
  })

  console.log(
    '[AppleAuth] Apple Sign-In returned:',
    response,
  )

  if (response.provider !== 'apple') {
    throw new Error(
      'Apple Sign-In returned an unexpected provider.',
    )
  }

  if (!response.result.idToken) {
    throw new Error(
      'Apple Sign-In did not return an identity token.',
    )
  }

  console.log('[AppleAuth] Apple identity token received')

  return {
    idToken: response.result.idToken,
  }
}

function createAppleAuthState(): string {
  if (
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID()
  }

  const bytes =
    globalThis.crypto.getRandomValues(
      new Uint8Array(16),
    )

  return Array.from(
    bytes,
    (value) =>
      value.toString(16).padStart(2, '0'),
  ).join('')
}

export async function requestAppleSignInToken(params: {
  clientId: string
  iosClientId?: string
  redirectURI?: string
}): Promise<AppleSignInResult> {

  const platform = Capacitor.getPlatform()

  // =====================================================
  // iOS
  // =====================================================

  if (platform === 'ios') {
    return requestNativeAppleSignInToken(
      params.iosClientId || params.clientId,
    )
  }

  // =====================================================
  // Android
  // =====================================================

  if (platform === 'android') {
    return requestNativeAppleSignInToken(
      ANDROID_APPLE_CLIENT_ID,
      ANDROID_APPLE_REDIRECT,
    )
  }

  // =====================================================
  // Web
  // =====================================================

  const appleAuth = window.AppleID?.auth

  if (!appleAuth) {
    throw new Error(
      'Apple Sign-In is not available right now.',
    )
  }

  const state = createAppleAuthState()

  appleAuth.init({
    clientId: params.clientId,
    scope: 'name email',
    redirectURI: params.redirectURI,
    state,
    usePopup: true,
  })

  const result = await appleAuth.signIn()

  if (result.error) {
    const description =
      result.error_description
        ? ` (${result.error_description})`
        : ''

    throw new Error(
      `Apple Sign-In error: ${result.error}${description}`,
    )
  }

  if (result.authorization?.state !== state) {
    throw new Error(
      'Apple sign-in returned an invalid authorization state. Please try again.',
    )
  }

  const idToken =
    result.authorization?.id_token

  if (!idToken) {
    throw new Error(
      'Apple sign-in did not return a valid token. Check Apple clientId/domain/redirectURI settings.',
    )
  }

  return { idToken }
}
import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'

export interface AppleSignInResult {
  idToken: string
}

let nativeInitializationRequest: Promise<void> | null = null

// =====================================================
// Android Apple Sign-In configuration
// =====================================================

const ANDROID_APPLE_CLIENT_ID =
  'com.quantech.filscore.web'

const ANDROID_APPLE_REDIRECT =
  'https://filscore-ai.quantech.international/api/auth/apple/callback'

// =====================================================
// Apple JS types
// =====================================================

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

// =====================================================
// Availability
// =====================================================

export function isAppleSignInReady(): boolean {
  return (
    Capacitor.isNativePlatform() ||
    Boolean(window.AppleID?.auth)
  )
}

// =====================================================
// Native Apple Sign-In
//
// IMPORTANT:
// iOS remains native iOS.
// Android uses the Android SocialLogin flow.
// Web continues to use Apple JS.
// =====================================================

export function isNativeAppleSignIn(): boolean {
  return Capacitor.isNativePlatform()
}

// =====================================================
// Native Apple Sign-In request
// =====================================================

async function requestNativeAppleSignInToken(
  clientId: string,
  redirectUrl?: string,
): Promise<AppleSignInResult> {
  if (!nativeInitializationRequest) {
    console.log(
      '[AppleAuth] Initializing Apple Sign-In',
    )

    const appleConfig: {
      clientId: string
      redirectUrl?: string
      useProperTokenExchange?: boolean
      useBroadcastChannel?: boolean
    } = {
      clientId,
    }

    // Android requires the backend callback.
    //
    // iOS does NOT receive this Android redirectUrl.
    if (redirectUrl) {
      appleConfig.redirectUrl = redirectUrl
      appleConfig.useProperTokenExchange = true
      appleConfig.useBroadcastChannel = false
    }

    nativeInitializationRequest =
      SocialLogin.initialize({
        apple: appleConfig,
      })
        .then(() => {
          console.log(
            '[AppleAuth] Apple initialization succeeded',
          )
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

  console.log(
    '[AppleAuth] Calling Apple Sign-In',
  )

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

  console.log(
    '[AppleAuth] Apple identity token received',
  )

  return {
    idToken: response.result.idToken,
  }
}

// =====================================================
// Apple JS state
// =====================================================

function createAppleAuthState(): string {
  if (
    typeof globalThis.crypto.randomUUID ===
    'function'
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

// =====================================================
// Main Apple Sign-In entry point
// =====================================================

export async function requestAppleSignInToken(
  params: {
    clientId: string
    iosClientId?: string
    redirectURI?: string
  },
): Promise<AppleSignInResult> {
  const platform = Capacitor.getPlatform()

  // ===================================================
  // iOS
  //
  // KEEP EXISTING iOS BEHAVIOR
  //
  // iOS uses:
  // com.quantech.filscore
  // ===================================================

  if (platform === 'ios') {
    console.log(
      '[AppleAuth] Using native iOS Apple Sign-In',
    )

    return requestNativeAppleSignInToken(
      params.iosClientId || params.clientId,
    )
  }

  // ===================================================
  // Android
  //
  // Android uses:
  // com.quantech.filscore.web
  //
  // Apple → Render callback → Android deep link
  // ===================================================

  if (platform === 'android') {
    console.log(
      '[AppleAuth] Using native Android Apple Sign-In',
    )

    console.log(
      '[AppleAuth] Android Apple client ID:',
      ANDROID_APPLE_CLIENT_ID,
    )

    console.log(
      '[AppleAuth] Android Apple redirect:',
      ANDROID_APPLE_REDIRECT,
    )

    return requestNativeAppleSignInToken(
      ANDROID_APPLE_CLIENT_ID,
      ANDROID_APPLE_REDIRECT,
    )
  }

  // ===================================================
  // Web
  //
  // KEEP EXISTING WEB APPLE JS FLOW
  // ===================================================

  console.log(
    '[AppleAuth] Using Apple JS web Sign-In',
  )

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

  return {
    idToken,
  }
}
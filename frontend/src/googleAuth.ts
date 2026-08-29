import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'

let initializationRequest: Promise<void> | null = null

export function isNativeGoogleSignIn(): boolean {
  return Capacitor.isNativePlatform()
}

export async function initializeNativeGoogleSignIn(
  webClientId: string,
  iosClientId: string,
): Promise<void> {
  if (!isNativeGoogleSignIn()) {
    return
  }

  const resolvedWebClientId = webClientId.trim()
  const resolvedIosClientId = iosClientId.trim()

  if (!resolvedWebClientId) {
    throw new Error('Google Web Client ID is not configured.')
  }

  if (Capacitor.getPlatform() === 'ios' && !resolvedIosClientId) {
    throw new Error('Google iOS Client ID is not configured.')
  }

  if (!initializationRequest) {
    console.log('[GoogleAuth] Initializing native Google Sign-In')
    console.log('[GoogleAuth] Web Client ID configured:', Boolean(resolvedWebClientId))
    console.log('[GoogleAuth] iOS Client ID configured:', Boolean(resolvedIosClientId))

    initializationRequest = SocialLogin.initialize({
      google: {
        webClientId: resolvedWebClientId,
        iOSClientId: resolvedIosClientId,
        mode: 'online',
      },
    }).then(() => {
      console.log('[GoogleAuth] Native Google initialization succeeded')
    }).catch((error) => {
      console.error('[GoogleAuth] Native Google initialization FAILED:', error)
      initializationRequest = null
      throw error
    })
  }

  await initializationRequest
}

export async function requestGoogleSignInToken(
  webClientId: string,
  iosClientId: string,
): Promise<string> {
  if (!isNativeGoogleSignIn()) {
    throw new Error('Native Google Sign-In is only available in the mobile app.')
  }

  await initializeNativeGoogleSignIn(webClientId, iosClientId)

  console.log('[GoogleAuth] Calling native Google Sign-In')

  const response = await SocialLogin.login({
    provider: 'google',
    options: {
      filterByAuthorizedAccounts: false,
    },
  })

  console.log('[GoogleAuth] Native Google Sign-In returned')

  if (response.provider !== 'google' || response.result.responseType !== 'online') {
    throw new Error('Google Sign-In did not return an identity token.')
  }

  const idToken = response.result.idToken

  if (!idToken) {
    throw new Error('Google Sign-In did not return an identity token.')
  }

  console.log('[GoogleAuth] Google identity token received')

  return idToken
}
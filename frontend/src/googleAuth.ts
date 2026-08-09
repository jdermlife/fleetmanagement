import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'

let initializationRequest: Promise<void> | null = null

export function isNativeGoogleSignIn(): boolean {
  return Capacitor.isNativePlatform()
}

export async function initializeNativeGoogleSignIn(webClientId: string): Promise<void> {
  if (!isNativeGoogleSignIn()) {
    return
  }

  const resolvedClientId = webClientId.trim()
  if (!resolvedClientId) {
    throw new Error('Google Sign-In is not configured for this mobile app.')
  }

  if (!initializationRequest) {
    initializationRequest = SocialLogin.initialize({
      google: {
        webClientId: resolvedClientId,
        mode: 'online',
      },
    }).catch((error) => {
      initializationRequest = null
      throw error
    })
  }

  await initializationRequest
}

export async function requestGoogleSignInToken(webClientId: string): Promise<string> {
  if (!isNativeGoogleSignIn()) {
    throw new Error('Native Google Sign-In is only available in the mobile app.')
  }

  await initializeNativeGoogleSignIn(webClientId)
  const response = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile'],
      filterByAuthorizedAccounts: false,
    },
  })

  if (response.provider !== 'google' || response.result.responseType !== 'online') {
    throw new Error('Google Sign-In did not return an identity token.')
  }

  const idToken = response.result.idToken
  if (!idToken) {
    throw new Error('Google Sign-In did not return an identity token.')
  }

  return idToken
}

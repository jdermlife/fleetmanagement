import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'

let initializationRequest: Promise<void> | null = null

export function isNativeGoogleSignIn(): boolean {
  return Capacitor.isNativePlatform()
}

export async function requestGoogleSignInToken(webClientId: string): Promise<string> {
  if (!isNativeGoogleSignIn()) {
    throw new Error('Native Google Sign-In is only available in the mobile app.')
  }

  if (!initializationRequest) {
    initializationRequest = SocialLogin.initialize({
      google: {
        webClientId,
        mode: 'online',
      },
    }).catch((error) => {
      initializationRequest = null
      throw error
    })
  }

  await initializationRequest
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
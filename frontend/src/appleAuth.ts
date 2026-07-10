export interface AppleSignInResult {
  idToken: string
}

type AppleAuthInitConfig = {
  clientId: string
  scope: string
  redirectURI?: string
  usePopup: boolean
}

type AppleAuthSignInResponse = {
  authorization?: {
    id_token?: string
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
  return Boolean(window.AppleID?.auth)
}

export async function requestAppleSignInToken(params: {
  clientId: string
  redirectURI?: string
}): Promise<AppleSignInResult> {
  const appleAuth = window.AppleID?.auth
  if (!appleAuth) {
    throw new Error('Apple Sign-In is not available right now.')
  }

  appleAuth.init({
    clientId: params.clientId,
    scope: 'name email',
    redirectURI: params.redirectURI,
    usePopup: true,
  })

  const result = await appleAuth.signIn()
  if (result.error) {
    const description = result.error_description ? ` (${result.error_description})` : ''
    throw new Error(`Apple Sign-In error: ${result.error}${description}`)
  }

  const idToken = result.authorization?.id_token
  if (!idToken) {
    throw new Error('Apple sign-in did not return a valid token. Check Apple clientId/domain/redirectURI settings.')
  }

  return { idToken }
}

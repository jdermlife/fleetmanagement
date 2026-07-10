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
    usePopup: true,
  })

  const result = await appleAuth.signIn()
  const idToken = result.authorization?.id_token
  if (!idToken) {
    throw new Error('Apple sign-in did not return a valid token.')
  }

  return { idToken }
}

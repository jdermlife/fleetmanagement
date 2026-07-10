export interface AppleSignInResult {
  idToken: string
}

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
  return Boolean(window.AppleID?.auth)
}

function createAppleAuthState(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function requestAppleSignInToken(params: {
  clientId: string
  redirectURI?: string
}): Promise<AppleSignInResult> {
  const appleAuth = window.AppleID?.auth
  if (!appleAuth) {
    throw new Error('Apple Sign-In is not available right now.')
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
    const description = result.error_description ? ` (${result.error_description})` : ''
    throw new Error(`Apple Sign-In error: ${result.error}${description}`)
  }

  if (result.authorization?.state !== state) {
    throw new Error('Apple sign-in returned an invalid authorization state. Please try again.')
  }

  const idToken = result.authorization?.id_token
  if (!idToken) {
    throw new Error('Apple sign-in did not return a valid token. Check Apple clientId/domain/redirectURI settings.')
  }

  return { idToken }
}

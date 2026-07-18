import axios from 'axios'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getErrorMessage, login, loginWithApple, loginWithGoogle, type AuthUser } from '../../api'
import { requestAppleSignInToken } from '../../appleAuth'
import { isBorrowerSubscriberRole } from '../../authRoles'
import { APP_NAME, APP_TAGLINE, brandLogoDataUri } from '../../brand'
import { isGoogleSignInAllowedForCurrentHost } from '../../googleAuthHostGuard'

const BORROWER_ALLOWED_REDIRECTS = new Set(['/lending-scorecard', '/financial-health-summary'])

async function resolveBorrowerRedirectPath(redirectTo: string): Promise<string> {
  if (redirectTo.startsWith('/lending-scorecard')) {
    return redirectTo
  }

  if (BORROWER_ALLOWED_REDIRECTS.has(redirectTo)) {
    return redirectTo
  }

  const [, redirectQuery = ''] = redirectTo.split('?', 2)
  const redirectApplicationNo = new URLSearchParams(redirectQuery).get('applicationNo')

  if (redirectApplicationNo) {
    return `/lending-scorecard?applicationNo=${encodeURIComponent(redirectApplicationNo)}`
  }

  return '/financial-health-summary'
}

function getDefaultRedirectPath() {
  return '/financial-health-summary'
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3.75 6.75h16.5a1.5 1.5 0 0 1 1.5 1.5v7.5a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-7.5a1.5 1.5 0 0 1 1.5-1.5Zm0 1.83v.28l8.25 5.08 8.25-5.08v-.28H3.75Zm16.5 1.87-7.46 4.59a1.5 1.5 0 0 1-1.58 0l-7.46-4.59v5.3a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-5.3Z"
        fill="currentColor"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.25a4.5 4.5 0 0 1 4.5 4.5v1.5h.75A2.25 2.25 0 0 1 19.5 10.5v8.25A2.25 2.25 0 0 1 17.25 21h-10.5A2.25 2.25 0 0 1 4.5 18.75V10.5A2.25 2.25 0 0 1 6.75 8.25h.75v-1.5A4.5 4.5 0 0 1 12 2.25Zm3 6V6.75a3 3 0 1 0-6 0v1.5h6Zm2.25 1.5h-10.5a.75.75 0 0 0-.75.75v8.25c0 .41.34.75.75.75h10.5c.41 0 .75-.34.75-.75V10.5a.75.75 0 0 0-.75-.75Zm-5.25 2.25a1.5 1.5 0 0 1 1.5 1.5c0 .63-.39 1.17-.94 1.39v1.36a.56.56 0 0 1-1.12 0v-1.36A1.5 1.5 0 0 1 10.5 13.5a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 5.25c4.94 0 8.23 4.2 9.36 5.88a1.5 1.5 0 0 1 0 1.74C20.23 14.55 16.94 18.75 12 18.75S3.77 14.55 2.64 12.87a1.5 1.5 0 0 1 0-1.74C3.77 9.45 7.06 5.25 12 5.25Zm0 1.5c-4.07 0-6.95 3.45-8.11 5.25 1.16 1.8 4.04 5.25 8.11 5.25s6.95-3.45 8.11-5.25c-1.16-1.8-4.04-5.25-8.11-5.25Zm0 2.25A3 3 0 1 1 9 12a3 3 0 0 1 3-3Zm0 1.5A1.5 1.5 0 1 0 13.5 12 1.5 1.5 0 0 0 12 10.5Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="m4.28 3.22 16.5 16.5-1.06 1.06-3.02-3.02A10.34 10.34 0 0 1 12 18.75c-4.94 0-8.23-4.2-9.36-5.88a1.5 1.5 0 0 1 0-1.74A16.84 16.84 0 0 1 7.1 6.63L3.22 2.72l1.06-1.06Zm3.9 4.96c-1.9 1.19-3.3 2.88-4.29 4.42 1.16 1.8 4.04 5.25 8.11 5.25 1.27 0 2.4-.34 3.38-.87l-2.01-2.01A3 3 0 0 1 9.03 10.6L8.18 9.74Zm3.3 1.18 2.6 2.6a1.5 1.5 0 0 0-2.6-2.6Zm.52-4.11c4.94 0 8.23 4.2 9.36 5.88a1.5 1.5 0 0 1 0 1.74 16.7 16.7 0 0 1-3.6 3.82l-1.08-1.08c1.51-1.08 2.64-2.46 3.43-3.69-1.16-1.8-4.04-5.25-8.11-5.25-.98 0-1.88.2-2.71.53l-1.2-1.2A8.82 8.82 0 0 1 12 5.25Z"
        fill="currentColor"
      />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M12.24 10.29v3.95h5.49c-.24 1.27-.96 2.35-2.05 3.08l3.31 2.57c1.93-1.78 3.05-4.39 3.05-7.49 0-.71-.06-1.4-.18-2.06h-9.62Z" />
      <path fill="#34A853" d="M12 22c2.76 0 5.07-.91 6.76-2.46l-3.31-2.57c-.92.62-2.1.99-3.45.99-2.65 0-4.89-1.79-5.69-4.19l-3.42 2.64A10 10 0 0 0 12 22Z" />
      <path fill="#4A90E2" d="M6.31 13.77A5.99 5.99 0 0 1 6 12c0-.61.11-1.2.31-1.77L2.89 7.59A10 10 0 0 0 2 12c0 1.62.39 3.16 1.09 4.41l3.22-2.64Z" />
      <path fill="#FBBC05" d="M12 6.04c1.5 0 2.84.52 3.89 1.53l2.91-2.91C17.06 3.05 14.75 2 12 2a10 10 0 0 0-8.91 5.59l3.42 2.64C7.11 7.83 9.35 6.04 12 6.04Z" />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || getDefaultRedirectPath()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
  const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID?.trim() || 'com.quantech.filscore.web'
  const appleRedirectUri = import.meta.env.VITE_APPLE_REDIRECT_URI?.trim()
    || 'https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback'
  const isGoogleHostAllowed = isGoogleSignInAllowedForCurrentHost()
  const isGoogleConfigured = googleClientId.length > 0
  const isGoogleEnabled = isGoogleConfigured && isGoogleHostAllowed
  const isAppleConfigured = appleClientId.length > 0
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const resolvePostLoginPath = async (user: AuthUser): Promise<string> => {
    if (isBorrowerSubscriberRole(user.role)) {
      return resolveBorrowerRedirectPath(redirectTo)
    }

    return redirectTo
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')

    try {
      const response = await login({ username, password })
      const nextPath = await resolvePostLoginPath(response.user)
      navigate(nextPath)
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to sign in right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    const idToken = response.credential
    if (!idToken) {
      setMessage('Google sign-in did not return a valid credential.')
      return
    }

    setIsSaving(true)
    setMessage('')
    try {
      const loginResponse = await loginWithGoogle({
        idToken,
      })
      const nextPath = await resolvePostLoginPath(loginResponse.user)
      navigate(nextPath)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail =
          typeof error.response?.data === 'object' && error.response?.data !== null
            ? (error.response.data as { detail?: unknown }).detail
            : undefined

        if (
          error.response?.status === 400 &&
          typeof detail === 'string' &&
          (
            detail.toLowerCase().includes('first-time google sign-in') ||
            detail.toLowerCase().includes('data-sharing preference')
          )
        ) {
          setMessage('For first-time Google users, please use Create Account to select account type and preferences.')
          return
        }
      }
      setMessage(getErrorMessage(error, 'Unable to sign in with Google right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleAppleSignIn = async () => {
    if (!isAppleConfigured) {
      setMessage('Apple Sign-In is available when configured.')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      const appleTokenResult = await requestAppleSignInToken({
        clientId: appleClientId,
        redirectURI: appleRedirectUri,
      })

      const loginResponse = await loginWithApple({
        idToken: appleTokenResult.idToken,
      })
      const nextPath = await resolvePostLoginPath(loginResponse.user)
      navigate(nextPath)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail =
          typeof error.response?.data === 'object' && error.response?.data !== null
            ? (error.response.data as { detail?: unknown }).detail
            : undefined

        if (
          error.response?.status === 400 &&
          typeof detail === 'string' &&
          (
            detail.toLowerCase().includes('first-time apple sign-in') ||
            detail.toLowerCase().includes('data-sharing preference')
          )
        ) {
          setMessage('For first-time Apple users, please use Create Account to select account type and preferences.')
          return
        }
      }
      if (error instanceof Error && error.message) {
        setMessage(error.message)
        return
      }
      setMessage(getErrorMessage(error, 'Unable to sign in with Apple right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="login-art-page">
      <div className="login-art-shell">
        <div className="login-art-brand">
          <img className="login-art-logo" src={brandLogoDataUri} alt={APP_NAME} />
          <div className="login-art-brand-copy">
            <p className="login-art-brand-name">{APP_NAME}</p>
            <p className="login-art-brand-tagline">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="login-art-card">
          <div className="login-art-social-stack" aria-live="polite">
            <div className="login-art-new-user">
              <span>New user?</span>
              <Link to="/register">Create Account</Link>
            </div>

            <button
              type="button"
              className="login-art-social-button login-art-social-button-apple"
              onClick={() => {
                void handleAppleSignIn()
              }}
              disabled={isSaving || !isAppleConfigured}
            >
              <svg className="login-art-social-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M11.182.008c0 .99-.37 1.98-1.04 2.68-.7.73-1.84 1.29-2.84 1.21-.13-.98.34-2 1.02-2.7.74-.76 1.93-1.3 2.86-1.19zM14.6 11.32c-.1.22-.2.42-.32.62-.18.29-.36.58-.56.86-.28.4-.5.68-.69.86-.29.3-.6.45-.93.46-.24 0-.53-.07-.86-.2-.34-.13-.65-.2-.94-.2-.3 0-.62.07-.97.2-.35.13-.63.2-.85.21-.32.01-.64-.15-.94-.47-.2-.2-.43-.5-.72-.9-.31-.44-.57-.95-.77-1.52-.22-.61-.33-1.2-.33-1.76 0-.65.14-1.22.42-1.71.22-.39.52-.7.88-.93.37-.23.77-.35 1.2-.35.26 0 .6.08 1 .24.4.16.67.24.78.24.08 0 .37-.09.85-.28.46-.18.85-.26 1.17-.24.88.07 1.53.42 1.97 1.05-.79.47-1.18 1.12-1.17 1.95 0 .65.24 1.2.72 1.63.22.2.46.35.73.45-.06.2-.12.39-.2.57z"
                />
              </svg>
              <span>Continue with Apple</span>
            </button>

            <div className="login-art-google-wrap">
              <div className="login-art-google-preview" aria-hidden={isGoogleEnabled}>
                <span className="login-art-social-icon login-art-google-icon">
                  <GoogleMark />
                </span>
                <span>Continue with Google</span>
              </div>
              {isGoogleEnabled ? (
                <div className="login-art-google-live">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setMessage('Unable to load Google Sign-In right now. Please try again.')}
                    text="continue_with"
                    size="large"
                    theme="outline"
                    shape="pill"
                    width="420"
                  />
                </div>
              ) : null}
            </div>

            {!isGoogleEnabled ? (
              isGoogleConfigured
                ? <p className="login-art-service-note">Google Sign-In is enabled on approved domains only.</p>
                : <p className="login-art-service-note">Google Sign-In is available when configured.</p>
            ) : null}
            {!isAppleConfigured ? (
              <p className="login-art-service-note">Apple Sign-In is available when configured.</p>
            ) : null}
          </div>

          <div className="login-art-divider" aria-hidden="true">
            <span>or</span>
          </div>

          <form className="login-art-form" onSubmit={handleSubmit}>
            <label className="login-art-field">
              <span className="login-art-field-icon">
                <MailIcon />
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="Email or username"
                className="login-art-input"
                required
              />
            </label>

            <label className="login-art-field">
              <span className="login-art-field-icon">
                <LockIcon />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Password"
                className="login-art-input"
                required
              />
              <button
                type="button"
                className="login-art-visibility-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </label>

            <button type="submit" className="login-art-submit" disabled={isSaving}>
              {isSaving ? 'Signing In...' : 'Log In'}
            </button>
          </form>

          {message ? <p className="login-art-message status-error">{message}</p> : null}

          <Link className="login-art-forgot" to="/forgot-password">
            Forgot Password?
          </Link>

          <div className="login-art-support-links">
            <Link to="/account">Account Settings</Link>
            <Link to="/subscription-fees">Fees</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/about-filscore">About</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

import axios from 'axios'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { getErrorMessage, login, loginWithApple, loginWithGoogle } from '../../api'
import { fetchLoanApplications, type LoanApplicationRecord } from '../../api/loan'
import { requestAppleSignInToken } from '../../appleAuth'
import { isBorrowerSubscriberRole } from '../../authRoles'

const LAST_ROUTE_STORAGE_KEY = 'fms:last-route'
const BORROWER_ALLOWED_REDIRECTS = new Set(['/lending-scorecard'])

function getMostRecentBorrowerApplication(records: LoanApplicationRecord[]): LoanApplicationRecord | null {
  if (records.length === 0) {
    return null
  }

  const recordsWithTimestamp = records
    .map((record) => {
      const timestampSource = record.updated_at || record.created_at
      const timestamp = timestampSource ? Date.parse(timestampSource) : Number.NaN
      return {
        record,
        timestamp,
      }
    })
    .filter((entry) => Number.isFinite(entry.timestamp))
    .sort((left, right) => right.timestamp - left.timestamp)

  if (recordsWithTimestamp.length > 0) {
    return recordsWithTimestamp[0].record
  }

  return records[0]
}

async function resolveBorrowerRedirectPath(redirectTo: string): Promise<string> {
  if (redirectTo.startsWith('/lending-scorecard')) {
    return redirectTo
  }

  const [, redirectQuery = ''] = redirectTo.split('?', 2)
  const redirectApplicationNo = new URLSearchParams(redirectQuery).get('applicationNo')

  if (redirectApplicationNo) {
    return `/lending-scorecard?applicationNo=${encodeURIComponent(redirectApplicationNo)}`
  }

  try {
    const applications = await fetchLoanApplications({ limit: 25 })
    const mostRecentApplication = getMostRecentBorrowerApplication(applications)

    if (mostRecentApplication?.application_no) {
      return `/lending-scorecard?applicationNo=${encodeURIComponent(mostRecentApplication.application_no)}`
    }
  } catch {
    // Fallback to scorecard when the lookup fails.
  }

  if (BORROWER_ALLOWED_REDIRECTS.has(redirectTo)) {
    return redirectTo
  }

  return '/lending-scorecard'
}

function getDefaultRedirectPath() {
  const storedPath = window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY)
  return storedPath || '/dashboard'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || getDefaultRedirectPath()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
  const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID?.trim() || ''
  const appleRedirectUri = import.meta.env.VITE_APPLE_REDIRECT_URI?.trim() || undefined
  const isGoogleConfigured = googleClientId.length > 0
  const isAppleConfigured = appleClientId.length > 0
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')

    try {
      const response = await login({ username, password })
      const nextPath = isBorrowerSubscriberRole(response.user.role)
        ? await resolveBorrowerRedirectPath(redirectTo)
        : redirectTo
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
      const nextPath = isBorrowerSubscriberRole(loginResponse.user.role)
        ? await resolveBorrowerRedirectPath(redirectTo)
        : redirectTo
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
      const nextPath = isBorrowerSubscriberRole(loginResponse.user.role)
        ? await resolveBorrowerRedirectPath(redirectTo)
        : redirectTo
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
      setMessage(getErrorMessage(error, 'Unable to sign in with Apple right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="standalone-card auth-screen">
      <h1>Sign In</h1>
      <p className="intro">
        Access your FILSCORE workspace with your existing account.
      </p>
      <p className="auth-role-copy">
        New users choose Create Account to avail of FILSCORE services.
      </p>

      <form className="stack-panel auth-panel" onSubmit={handleSubmit}>
        <label>
          Username or email
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="jane.doe or jane@example.com"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </label>

        <div className="form-actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Signing In...' : 'Sign In'}
          </button>
          <Link className="auth-link-button" to="/register">
            Create Account
          </Link>
          <Link className="auth-link-button" to="/forgot-password">
            Forgot Password
          </Link>
        </div>

        <div className="stack-panel auth-panel" aria-live="polite">
          <p className="auth-role-copy">Or continue using your Google account.</p>
          {isGoogleConfigured ? (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setMessage('Unable to load Google Sign-In right now. Please try again.')}
              text="continue_with"
              size="large"
              theme="outline"
              shape="rectangular"
            />
          ) : null}
          {!isGoogleConfigured ? (
            <p className="status-message">Google Sign-In is available when configured.</p>
          ) : null}
          <p className="auth-role-copy">Or continue using your Apple account.</p>
          <button
            type="button"
            className="auth-link-button auth-apple-button"
            onClick={() => {
              void handleAppleSignIn()
            }}
            disabled={isSaving || !isAppleConfigured}
          >
            <svg className="auth-apple-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M11.182.008c0 .99-.37 1.98-1.04 2.68-.7.73-1.84 1.29-2.84 1.21-.13-.98.34-2 1.02-2.7.74-.76 1.93-1.3 2.86-1.19zM14.6 11.32c-.1.22-.2.42-.32.62-.18.29-.36.58-.56.86-.28.4-.5.68-.69.86-.29.3-.6.45-.93.46-.24 0-.53-.07-.86-.2-.34-.13-.65-.2-.94-.2-.3 0-.62.07-.97.2-.35.13-.63.2-.85.21-.32.01-.64-.15-.94-.47-.2-.2-.43-.5-.72-.9-.31-.44-.57-.95-.77-1.52-.22-.61-.33-1.2-.33-1.76 0-.65.14-1.22.42-1.71.22-.39.52-.7.88-.93.37-.23.77-.35 1.2-.35.26 0 .6.08 1 .24.4.16.67.24.78.24.08 0 .37-.09.85-.28.46-.18.85-.26 1.17-.24.88.07 1.53.42 1.97 1.05-.79.47-1.18 1.12-1.17 1.95 0 .65.24 1.2.72 1.63.22.2.46.35.73.45-.06.2-.12.39-.2.57z"
              />
            </svg>
            Continue with Apple
          </button>
          {!isAppleConfigured ? (
            <p className="status-message">Apple Sign-In is available when configured.</p>
          ) : null}
        </div>

        {message ? <p className="status-message status-error">{message}</p> : null}
      </form>

      <div className="auth-support-links">
        <Link to="/account">Account Settings</Link>
        <Link to="/subscription-fees">Subscription Fees</Link>
        <Link to="/privacy">Privacy Disclosures</Link>
        <Link to="/terms">Terms & Consent</Link>
        <Link to="/about-filscore">About</Link>
      </div>
    </div>
  )
}

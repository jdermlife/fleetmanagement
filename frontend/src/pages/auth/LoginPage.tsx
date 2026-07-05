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
const BORROWER_ALLOWED_REDIRECTS = new Set(['/lending-scorecard', '/loan-certification'])

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
  if (BORROWER_ALLOWED_REDIRECTS.has(redirectTo)) {
    return redirectTo
  }

  try {
    const applications = await fetchLoanApplications({ limit: 25 })
    const mostRecentApplication = getMostRecentBorrowerApplication(applications)

    if (mostRecentApplication?.application_no) {
      return `/lending-scorecard?applicationNo=${encodeURIComponent(mostRecentApplication.application_no)}`
    }
  } catch {
    // Fallback to a fresh draft flow when the lookup fails.
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
            className="auth-link-button"
            onClick={() => {
              void handleAppleSignIn()
            }}
            disabled={isSaving || !isAppleConfigured}
          >
            Continue with Apple
          </button>
          {!isAppleConfigured ? (
            <p className="status-message">Apple Sign-In is available when configured.</p>
          ) : null}
        </div>

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

        {message ? <p className="status-message status-error">{message}</p> : null}
      </form>

      <div className="auth-support-links">
        <Link to="/account">Account Settings</Link>
        <Link to="/subscription-fees">Subscription Fees</Link>
        <Link to="/privacy">Privacy Disclosures</Link>
        <Link to="/terms">Terms & Consent</Link>
      </div>
    </div>
  )
}

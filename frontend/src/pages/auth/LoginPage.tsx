import axios from 'axios'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { getErrorMessage, login, loginWithGoogle } from '../../api'
import {
  REGISTER_SUBSCRIBER_OPTIONS,
  type RegisterSubscriberType,
  isBorrowerSubscriberRole,
} from '../../authRoles'

const LAST_ROUTE_STORAGE_KEY = 'fms:last-route'
const BORROWER_ALLOWED_REDIRECTS = new Set(['/lending-scorecard', '/loan-certification'])

function getDefaultRedirectPath() {
  const storedPath = window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY)
  return storedPath || '/dashboard'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || getDefaultRedirectPath()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
  const isGoogleConfigured = googleClientId.length > 0
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [subscriberType, setSubscriberType] = useState<RegisterSubscriberType | ''>('')
  const [lenderDataSharingChoice, setLenderDataSharingChoice] = useState<'share' | 'do_not_share' | ''>('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showGoogleRoleHint, setShowGoogleRoleHint] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')
    setShowGoogleRoleHint(false)

    try {
      const response = await login({ username, password })
      const nextPath = isBorrowerSubscriberRole(response.user.role)
        ? (BORROWER_ALLOWED_REDIRECTS.has(redirectTo) ? redirectTo : '/lending-scorecard')
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
    setShowGoogleRoleHint(false)
    try {
      const loginResponse = await loginWithGoogle({
        idToken,
        subscriberType: subscriberType || undefined,
        lenderDataSharingConsent:
          lenderDataSharingChoice === ''
            ? undefined
            : lenderDataSharingChoice === 'share',
      })
      const nextPath = isBorrowerSubscriberRole(loginResponse.user.role)
        ? (BORROWER_ALLOWED_REDIRECTS.has(redirectTo) ? redirectTo : '/lending-scorecard')
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
          setShowGoogleRoleHint(true)
        }
      }
      setMessage(getErrorMessage(error, 'Unable to sign in with Google right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="standalone-card auth-screen">
      <h1>Sign In</h1>
      <p className="intro">
        Access your fleet, lending, and governance workspace with your existing account.
      </p>
      <p className="auth-role-copy">
        New users choose Applicant / Borrower or Lender during account registration.
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

        {message ? <p className="status-message status-error">{message}</p> : null}
      </form>

      <div className="stack-panel auth-panel" aria-live="polite">
        <p className="auth-role-copy">Or continue using your Google account.</p>
        <fieldset className="auth-role-fieldset">
          <legend>First-time Google Sign-In (optional for existing users)</legend>
          <p className="auth-role-copy">
            Select borrower or lender if this is your first Google login.
          </p>
          {showGoogleRoleHint ? (
            <p className="status-message status-error">
              Select Borrower or Lender above, then try Google Sign-In again.
            </p>
          ) : null}
          <div className="auth-role-options">
            {REGISTER_SUBSCRIBER_OPTIONS.map((option) => (
              <label key={option.value} className="auth-role-option">
                <input
                  type="radio"
                  name="google-subscriber-type"
                  value={option.value}
                  checked={subscriberType === option.value}
                  onChange={(event) =>
                    setSubscriberType(event.target.value as RegisterSubscriberType)
                  }
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="auth-role-fieldset">
          <legend>First-time Google data sharing (optional for existing users)</legend>
          <p className="auth-role-copy">
            Choose whether lenders can view your profile and score for offers.
          </p>
          <div className="auth-role-options">
            <label className="auth-role-option">
              <input
                type="radio"
                name="google-lender-data-sharing"
                value="share"
                checked={lenderDataSharingChoice === 'share'}
                onChange={() => setLenderDataSharingChoice('share')}
              />
              <span>
                <strong>Okay to share for lender offers</strong>
                <small>Lenders can view your profile and score for matching offers.</small>
              </span>
            </label>
            <label className="auth-role-option">
              <input
                type="radio"
                name="google-lender-data-sharing"
                value="do_not_share"
                checked={lenderDataSharingChoice === 'do_not_share'}
                onChange={() => setLenderDataSharingChoice('do_not_share')}
              />
              <span>
                <strong>Do not share for lender offers</strong>
                <small>Your profile and score are excluded from lender offer matching.</small>
              </span>
            </label>
          </div>
        </fieldset>
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
      </div>

      <div className="auth-support-links">
        <Link to="/account">Account Settings</Link>
        <Link to="/subscription-fees">Subscription Fees</Link>
        <Link to="/privacy">Privacy Disclosures</Link>
        <Link to="/terms">Terms & Consent</Link>
      </div>
    </div>
  )
}

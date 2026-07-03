import axios from 'axios'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { getErrorMessage, login, loginWithGoogle } from '../../api'
import {
  REGISTER_SUBSCRIBER_OPTIONS,
  type RegisterSubscriberType,
  isBorrowerSubscriberRole,
} from '../../authRoles'

const LAST_ROUTE_STORAGE_KEY = 'fms:last-route'
const BORROWER_ALLOWED_REDIRECTS = new Set(['/lending-scorecard', '/loan-certification'])
const GOOGLE_SCRIPT_ID = 'google-identity-services-script'

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
  }) => void
  renderButton: (
    element: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'small' | 'medium' | 'large'
      text?: 'signin_with' | 'signup_with' | 'continue_with'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      width?: number
    },
  ) => void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId
      }
    }
  }
}

function getDefaultRedirectPath() {
  const storedPath = window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY)
  return storedPath || '/dashboard'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const redirectTo = searchParams.get('redirect') || getDefaultRedirectPath()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [subscriberType, setSubscriberType] = useState<RegisterSubscriberType | ''>('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
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

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
    if (!googleClientId || typeof window === 'undefined') {
      setGoogleReady(false)
      return
    }

    const initializeGoogleButton = () => {
      const accounts = window.google?.accounts?.id
      if (!accounts || !googleButtonRef.current) {
        return
      }

      accounts.initialize({
        client_id: googleClientId,
        callback: async (response: GoogleCredentialResponse) => {
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
                detail.toLowerCase().includes('first-time google sign-in')
              ) {
                setShowGoogleRoleHint(true)
              }
            }
            setMessage(getErrorMessage(error, 'Unable to sign in with Google right now.'))
          } finally {
            setIsSaving(false)
          }
        },
      })

      googleButtonRef.current.innerHTML = ''
      accounts.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 300,
      })
      setGoogleReady(true)
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      initializeGoogleButton()
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initializeGoogleButton
    script.onerror = () => setMessage('Unable to load Google Sign-In right now. Please try again.')
    document.head.appendChild(script)
  }, [navigate, redirectTo])

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
        <div ref={googleButtonRef} />
        {!googleReady ? (
          <p className="status-message">Google Sign-In is available when configured.</p>
        ) : null}
      </div>

      <div className="auth-support-links">
        <Link to="/account">Account Settings</Link>
        <Link to="/privacy">Privacy Disclosures</Link>
        <Link to="/terms">Terms & Consent</Link>
      </div>
    </div>
  )
}

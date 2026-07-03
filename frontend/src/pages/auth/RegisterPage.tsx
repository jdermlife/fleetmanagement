import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { getErrorMessage, loginWithGoogle, register } from '../../api'
import {
  REGISTER_SUBSCRIBER_OPTIONS,
  type RegisterSubscriberType,
} from '../../authRoles'

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

export default function RegisterPage() {
  const navigate = useNavigate()
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [subscriberType, setSubscriberType] = useState<RegisterSubscriberType | ''>('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      setMessage('Password and confirmation password do not match.')
      return
    }

    if (!subscriberType) {
      setMessage('Please select whether this account is for an applicant / borrower or a lender.')
      return
    }

    if (!acceptedTerms || !acceptedPrivacy) {
      setMessage('Review and accept the terms and privacy disclosures to continue.')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      await register({ username, email, password, subscriberType })
      navigate('/login?created=1')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to create your account right now.'))
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
            setMessage('Google sign-up did not return a valid credential.')
            return
          }

          if (!subscriberType) {
            setMessage('Select borrower or lender before continuing with Google.')
            return
          }

          if (!acceptedTerms || !acceptedPrivacy) {
            setMessage('Review and accept the terms and privacy disclosures to continue.')
            return
          }

          setIsSaving(true)
          setMessage('')
          try {
            await loginWithGoogle({
              idToken,
              subscriberType,
            })
            navigate('/dashboard')
          } catch (error) {
            setMessage(getErrorMessage(error, 'Unable to continue with Google right now.'))
          } finally {
            setIsSaving(false)
          }
        },
      })

      googleButtonRef.current.innerHTML = ''
      accounts.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signup_with',
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
    script.onerror = () => setMessage('Unable to load Google Sign-Up right now. Please try again.')
    document.head.appendChild(script)
  }, [acceptedPrivacy, acceptedTerms, navigate, subscriberType])

  return (
    <div className="standalone-card auth-screen">
      <h1>Create Account</h1>
      <p className="intro">
        Register a user account.  Review and accet the legal disclosures before 
        before continuing.
      </p>

      <form className="stack-panel auth-panel" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            minLength={3}
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <fieldset className="auth-role-fieldset">
          <legend>Subscriber type</legend>
          <p className="auth-role-copy">
            Select the  access this new account should receive.
          </p>
          <div className="auth-role-options">
            {REGISTER_SUBSCRIBER_OPTIONS.map((option) => (
              <label key={option.value} className="auth-role-option">
                <input
                  type="radio"
                  name="subscriber-type"
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

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          <span>
            I reviewed and accept the <Link to="/terms">Terms & Consent</Link>.
          </span>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={acceptedPrivacy}
            onChange={(event) => setAcceptedPrivacy(event.target.checked)}
          />
          <span>
            I reviewed and accept the <Link to="/privacy">Privacy Disclosures</Link>.
          </span>
        </label>

        <div className="form-actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Creating Account...' : 'Create Account'}
          </button>
          <Link className="auth-link-button" to="/login">
            Back to Login
          </Link>
        </div>

        {message ? <p className="status-message status-error">{message}</p> : null}
      </form>

      <div className="stack-panel auth-panel" aria-live="polite">
        <p className="auth-role-copy">Or create your account using Google.</p>
        <div ref={googleButtonRef} />
        {!googleReady ? (
          <p className="status-message">Google Sign-Up is available when configured.</p>
        ) : null}
      </div>
    </div>
  )
}

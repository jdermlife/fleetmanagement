import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { getErrorMessage, loginWithGoogle, register } from '../../api'
import {
  REGISTER_SUBSCRIBER_OPTIONS,
  type RegisterSubscriberType,
} from '../../authRoles'

export default function RegisterPage() {
  const navigate = useNavigate()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
  const isGoogleConfigured = googleClientId.length > 0
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [subscriberType, setSubscriberType] = useState<RegisterSubscriberType | ''>('')
  const [lenderDataSharingChoice, setLenderDataSharingChoice] = useState<'share' | 'do_not_share' | ''>('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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

    if (!lenderDataSharingChoice) {
      setMessage('Please choose whether lenders can view your information and score for offers.')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      await register({
        username,
        email,
        password,
        subscriberType,
        lenderDataSharingConsent: lenderDataSharingChoice === 'share',
      })
      navigate('/login?created=1')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to create your account right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleGoogleSuccess = async (response: CredentialResponse) => {
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

    if (!lenderDataSharingChoice) {
      setMessage('Choose your lender data-sharing preference before continuing with Google.')
      return
    }

    setIsSaving(true)
    setMessage('')
    try {
      await loginWithGoogle({
        idToken,
        subscriberType,
        lenderDataSharingConsent: lenderDataSharingChoice === 'share',
      })
      navigate('/dashboard')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to continue with Google right now.'))
    } finally {
      setIsSaving(false)
    }
  }

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

        <fieldset className="auth-role-fieldset">
          <legend>Lender Offer Preference</legend>
          <p className="auth-role-copy">
            Choose whether lenders may view your information and score to offer financing.
          </p>
          <div className="auth-role-options">
            <label className="auth-role-option">
              <input
                type="radio"
                name="lender-data-sharing"
                value="share"
                checked={lenderDataSharingChoice === 'share'}
                onChange={() => setLenderDataSharingChoice('share')}
              />
              <span>
                <strong>Okay to share information and score for lender offers</strong>
                <small>Lenders can use your profile and score to send relevant offers.</small>
              </span>
            </label>
            <label className="auth-role-option">
              <input
                type="radio"
                name="lender-data-sharing"
                value="do_not_share"
                checked={lenderDataSharingChoice === 'do_not_share'}
                onChange={() => setLenderDataSharingChoice('do_not_share')}
              />
              <span>
                <strong>Do not share information and score for lender offers</strong>
                <small>Your information is not used for lender offer matching.</small>
              </span>
            </label>
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
        {isGoogleConfigured ? (
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setMessage('Unable to load Google Sign-Up right now. Please try again.')}
            text="signup_with"
            size="large"
            theme="outline"
            shape="rectangular"
          />
        ) : null}
        {!isGoogleConfigured ? (
          <p className="status-message">Google Sign-Up is available when configured.</p>
        ) : null}
      </div>

      <div className="auth-support-links">
        <Link to="/subscription-fees">Subscription Fees</Link>
        <Link to="/privacy">Privacy Disclosures</Link>
        <Link to="/terms">Terms & Consent</Link>
      </div>
    </div>
  )
}

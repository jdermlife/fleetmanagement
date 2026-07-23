import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { createFreeSubscription, getErrorMessage, login, loginWithApple, loginWithGoogle, register } from '../../api'
import { requestAppleSignInToken } from '../../appleAuth'
import {
  REGISTER_SUBSCRIBER_OPTIONS,
  type RegisterSubscriberType,
} from '../../authRoles'
import { isGoogleSignInAllowedForCurrentHost } from '../../googleAuthHostGuard'

export default function RegisterPage() {
  const monthlyPlanFee = 160
  const freeTrialDays = 2
  const navigate = useNavigate()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''
  const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID?.trim() || 'com.quantech.filscore.web'
  const appleRedirectUri = import.meta.env.VITE_APPLE_REDIRECT_URI?.trim()
    || 'https://fleetmanagement-flame.vercel.app/backend/api/auth/apple/callback'
  const isGoogleHostAllowed = isGoogleSignInAllowedForCurrentHost()
  const isGoogleConfigured = googleClientId.length > 0
  const isGoogleEnabled = isGoogleConfigured && isGoogleHostAllowed
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [subscriberType, setSubscriberType] = useState<RegisterSubscriberType | ''>('')
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [paymentProvider, setPaymentProvider] = useState<'PAYMONGO' | 'PAYPAL' | ''>('')
  const [debitAccountName, setDebitAccountName] = useState('')
  const [debitPaymentReference, setDebitPaymentReference] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [message, setMessage] = useState('')
  const [appleMessage, setAppleMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isAppleSaving, setIsAppleSaving] = useState(false)
  const hasPaymentDetails =
    paymentProvider.length > 0
    && debitAccountName.trim().length > 1
    && debitPaymentReference.trim().length > 3

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

    if (!hasPaymentDetails) {
      setMessage('Provide your debit payment details using PayMongo or PayPal to continue.')
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
        lenderDataSharingConsent: marketingConsent,
      })
      const loginResponse = await login({ username, password })
      await createFreeSubscription({ user_id: loginResponse.user.id })
      navigate('/financial-health-summary', { replace: true })
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

    if (!hasPaymentDetails) {
      setMessage('Provide your debit payment details using PayMongo or PayPal to continue.')
      return
    }

    setIsSaving(true)
    setMessage('')
    try {
      const loginResponse = await loginWithGoogle({
        idToken,
        subscriberType,
        lenderDataSharingConsent: marketingConsent,
      })
      await createFreeSubscription({ user_id: loginResponse.user.id })
      navigate('/financial-health-summary', { replace: true })
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to continue with Google right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleAppleSignUp = async () => {
    if (!subscriberType) {
      setAppleMessage('Select borrower or lender before continuing with Apple.')
      return
    }

    if (!acceptedTerms || !acceptedPrivacy) {
      setAppleMessage('Review and accept the terms and privacy disclosures to continue.')
      return
    }

    if (!hasPaymentDetails) {
      setAppleMessage('Provide your debit payment details using PayMongo or PayPal to continue.')
      return
    }

    setIsSaving(true)
    setIsAppleSaving(true)
    setAppleMessage('')
    try {
      const appleTokenResult = await requestAppleSignInToken({
        clientId: appleClientId,
        redirectURI: appleRedirectUri,
      })
      const loginResponse = await loginWithApple({
        idToken: appleTokenResult.idToken,
        subscriberType,
        lenderDataSharingConsent: marketingConsent,
      })
      await createFreeSubscription({ user_id: loginResponse.user.id })
      navigate('/financial-health-summary', { replace: true })
    } catch (error) {
      if (error instanceof Error && error.message) {
        setAppleMessage(error.message)
        return
      }
      setAppleMessage(getErrorMessage(error, 'Unable to continue with Apple right now.'))
    } finally {
      setIsSaving(false)
      setIsAppleSaving(false)
    }
  }

  return (
    <div className="standalone-card auth-screen">
      <h1>Welcome to  FILSCORE ! Please Create Account</h1>
      <p className="intro">
        Review the legal disclosures and agree by ticking the boxes
        before continuing.
      </p>

      <div className="stack-panel auth-panel">
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

        <fieldset className="auth-role-fieldset">
          <legend>Marketing Consent</legend>
          <p className="auth-role-copy">
            Tick the box if you agree to receive marketing materials, notices, and related updates.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(event) => setMarketingConsent(event.target.checked)}
            />
            <span>
              I agree to receive marketing materials, notices, and related product updates.
            </span>
          </label>
        </fieldset>



        <fieldset className="auth-role-fieldset">
          <legend>Subscriber type</legend>
          <p className="auth-role-copy">
            Select the access this new account should receive.
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
          <legend>Plan and Debit Payment</legend>
          <p className="auth-role-copy register-payment-plan">
            Plan fee: PHP {monthlyPlanFee} per month. Free for the first {freeTrialDays} days.
          </p>
          <p className="auth-role-copy">
            Provide debit payment details via PayMongo or PayPal to unlock the Create Account section.
          </p>

          <div className="auth-role-options">
            <label className="auth-role-option">
              <input
                type="radio"
                name="debit-payment-provider"
                value="PAYMONGO"
                checked={paymentProvider === 'PAYMONGO'}
                onChange={() => setPaymentProvider('PAYMONGO')}
              />
              <span>
                <strong>PayMongo</strong>
                <small>Debit or card payment processed through PayMongo.</small>
              </span>
            </label>
            <label className="auth-role-option">
              <input
                type="radio"
                name="debit-payment-provider"
                value="PAYPAL"
                checked={paymentProvider === 'PAYPAL'}
                onChange={() => setPaymentProvider('PAYPAL')}
              />
              <span>
                <strong>PayPal</strong>
                <small>Debit payment routed through your PayPal checkout.</small>
              </span>
            </label>
          </div>

          <label>
            Debit Account Name
            <input
              value={debitAccountName}
              onChange={(event) => setDebitAccountName(event.target.value)}
              autoComplete="cc-name"
              placeholder="Account or cardholder name"
            />
          </label>

          <label>
            Payment Reference / Last 4 Digits
            <input
              value={debitPaymentReference}
              onChange={(event) => setDebitPaymentReference(event.target.value)}
              autoComplete="off"
              placeholder="Reference number or last 4 digits"
            />
          </label>

          <p className="status-message">
            {hasPaymentDetails
              ? 'Payment details captured. Create Account section is now unlocked.'
              : 'Create Account section is blurred until payment details are provided.'}
          </p>
        </fieldset>
      </div>

      <div className="stack-panel auth-panel" aria-live="polite">
        <p className="auth-role-copy">
          <strong>Create Account Using:</strong>
        </p>
        <p className="auth-role-copy">Google Account</p>
        {isGoogleEnabled ? (
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setMessage('Unable to load Google Sign-Up right now. Please try again.')}
            text="signup_with"
            size="large"
            theme="outline"
            shape="rectangular"
          />
        ) : null}
        {!isGoogleEnabled ? (
          isGoogleConfigured
            ? <p className="status-message">Google Sign-Up is enabled on approved domains only.</p>
            : <p className="status-message">Google Sign-Up is available when configured.</p>
        ) : null}

        <p className="auth-role-copy">Apple Account</p>
        <button
          type="button"
          className="auth-link-button auth-apple-button"
          onClick={() => {
            void handleAppleSignUp()
          }}
          disabled={isSaving}
          aria-describedby={appleMessage ? 'apple-sign-up-message' : undefined}
        >
          <svg className="auth-apple-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M11.182.008c0 .99-.37 1.98-1.04 2.68-.7.73-1.84 1.29-2.84 1.21-.13-.98.34-2 1.02-2.7.74-.76 1.93-1.3 2.86-1.19zM14.6 11.32c-.1.22-.2.42-.32.62-.18.29-.36.58-.56.86-.28.4-.5.68-.69.86-.29.3-.6.45-.93.46-.24 0-.53-.07-.86-.2-.34-.13-.65-.2-.94-.2-.3 0-.62.07-.97.2-.35.13-.63.2-.85.21-.32.01-.64-.15-.94-.47-.2-.2-.43-.5-.72-.9-.31-.44-.57-.95-.77-1.52-.22-.61-.33-1.2-.33-1.76 0-.65.14-1.22.42-1.71.22-.39.52-.7.88-.93.37-.23.77-.35 1.2-.35.26 0 .6.08 1 .24.4.16.67.24.78.24.08 0 .37-.09.85-.28.46-.18.85-.26 1.17-.24.88.07 1.53.42 1.97 1.05-.79.47-1.18 1.12-1.17 1.95 0 .65.24 1.2.72 1.63.22.2.46.35.73.45-.06.2-.12.39-.2.57z"
            />
          </svg>
          {isAppleSaving ? 'Continuing with Apple...' : 'Sign with Apple'}
        </button>
        {appleMessage ? (
          <p id="apple-sign-up-message" className="status-message status-error" role="alert">
            {appleMessage}
          </p>
        ) : null}

        <p className="auth-role-copy">
          <strong>Other Email</strong>
        </p>
      </div>

      <div className="register-form-gate">
        <form
          className={`stack-panel auth-panel ${hasPaymentDetails ? '' : 'register-form-blurred'}`}
          onSubmit={handleSubmit}
        >
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

        {!hasPaymentDetails ? (
          <div className="register-form-lock-overlay" role="status" aria-live="polite">
            Complete payment details to unlock account creation.
          </div>
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

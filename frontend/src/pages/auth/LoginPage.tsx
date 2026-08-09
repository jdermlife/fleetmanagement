import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { APP_NAME, APP_TAGLINE, brandLogoDataUri } from '../../brand'
import SubscriptionPlansDisclosure from '../legal/SubscriptionPlansDisclosure'

type RegistrationMethod = 'apple' | 'google' | 'email'

function AppleMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M11.182.008c0 .99-.37 1.98-1.04 2.68-.7.73-1.84 1.29-2.84 1.21-.13-.98.34-2 1.02-2.7.74-.76 1.93-1.3 2.86-1.19zM14.6 11.32c-.1.22-.2.42-.32.62-.18.29-.36.58-.56.86-.28.4-.5.68-.69.86-.29.3-.6.45-.93.46-.24 0-.53-.07-.86-.2-.34-.13-.65-.2-.94-.2-.3 0-.62.07-.97.2-.35.13-.63.2-.85.21-.32.01-.64-.15-.94-.47-.2-.2-.43-.5-.72-.9-.31-.44-.57-.95-.77-1.52-.22-.61-.33-1.2-.33-1.76 0-.65.14-1.22.42-1.71.22-.39.52-.7.88-.93.37-.23.77-.35 1.2-.35.26 0 .6.08 1 .24.4.16.67.24.78.24.08 0 .37-.09.85-.28.46-.18.85-.26 1.17-.24.88.07 1.53.42 1.97 1.05-.79.47-1.18 1.12-1.17 1.95 0 .65.24 1.2.72 1.63.22.2.46.35.73.45-.06.2-.12.39-.2.57z"
      />
    </svg>
  )
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
  const [showFees, setShowFees] = useState(false)
  const feesDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = feesDialogRef.current
    if (!dialog) {
      return
    }

    if (showFees && !dialog.open) {
      dialog.showModal()
    } else if (!showFees && dialog.open) {
      dialog.close()
    }
  }, [showFees])

  const openRegistration = (registrationMethod: RegistrationMethod) => {
    navigate('/register', { state: { registrationMethod } })
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
          <div className="login-art-social-stack">
            <div className="login-art-new-user">
              <span>New user?</span>
              <Link to="/register">Create Account</Link>
            </div>

            <button
              type="button"
              className="login-art-social-button login-art-social-button-apple"
              onClick={() => openRegistration('apple')}
            >
              <span className="login-art-social-icon"><AppleMark /></span>
              <span>Continue with Apple</span>
            </button>

            <button
              type="button"
              className="login-art-social-button"
              onClick={() => openRegistration('google')}
            >
              <span className="login-art-social-icon login-art-google-icon"><GoogleMark /></span>
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              className="login-art-social-button login-art-social-button-email"
              onClick={() => openRegistration('email')}
            >
              <span className="login-art-social-icon"><MailIcon /></span>
              <span>Other Email</span>
            </button>
          </div>

          <div className="login-art-support-links">
            <Link to="/account">Account Settings</Link>
            <button type="button" onClick={() => setShowFees(true)}>Fees</button>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/about-filscore">About</Link>
            <Link to="/return-refund-policy">Returns &amp; Refunds</Link>
            <Link to="/customer-service">Customer Service</Link>
            <Link to="/dispute-resolution">Dispute Resolution</Link>
          </div>
        </div>
      </div>

      <dialog
        ref={feesDialogRef}
        className="login-fees-dialog"
        aria-labelledby="login-fees-title"
        onCancel={() => setShowFees(false)}
        onClose={() => setShowFees(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setShowFees(false)
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setShowFees(false)
          }
        }}
      >
        <div className="login-fees-dialog-header">
          <div>
            <p>Plans and fees</p>
            <h2 id="login-fees-title">Subscription options</h2>
          </div>
          <button type="button" onClick={() => setShowFees(false)}>Close</button>
        </div>
        <p className="login-fees-dialog-intro">
          Review the latest published plans and billing amounts before registration.
        </p>
        {showFees ? <SubscriptionPlansDisclosure /> : null}
      </dialog>
    </div>
  )
}

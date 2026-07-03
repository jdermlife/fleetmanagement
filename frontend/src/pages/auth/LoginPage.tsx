import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { getErrorMessage, login } from '../../api'
import { isBorrowerSubscriberRole } from '../../authRoles'

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
        ? (BORROWER_ALLOWED_REDIRECTS.has(redirectTo) ? redirectTo : '/lending-scorecard')
        : redirectTo
      navigate(nextPath)
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to sign in right now.'))
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

      <div className="auth-support-links">
        <Link to="/account">Account Settings</Link>
        <Link to="/privacy">Privacy Disclosures</Link>
        <Link to="/terms">Terms & Consent</Link>
      </div>
    </div>
  )
}

import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { getErrorMessage, requestPasswordReset } from '../../api'

export default function ForgotPasswordPage() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [message, setMessage] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [userId, setUserId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')
    setResetToken('')
    setUserId(null)

    try {
      const response = await requestPasswordReset(emailOrUsername)
      setMessage(response.message)
      setResetToken(response.reset_token ?? '')
      setUserId(response.user_id ?? null)
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to start password reset right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="standalone-card auth-screen">
      <h1>Forgot Password</h1>
      <p className="intro">
        Enter your username or email to request a password reset token.
      </p>

      <form className="stack-panel auth-panel" onSubmit={handleSubmit}>
        <label>
          Username or email
          <input
            value={emailOrUsername}
            onChange={(event) => setEmailOrUsername(event.target.value)}
            autoComplete="username"
            placeholder="jane.doe or jane@example.com"
            required
          />
        </label>

        <div className="form-actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Requesting...' : 'Request Reset'}
          </button>
          <Link className="auth-link-button" to="/login">
            Back to Login
          </Link>
        </div>
      </form>

      {message ? <p className="status-message">{message}</p> : null}

      {resetToken && userId ? (
        <div className="card auth-helper-card">
          <h3>Development Reset Token</h3>
          <p>
            The current backend can return a reset token in development mode. Use it to finish
            the reset flow.
          </p>
          <p>
            <strong>User ID:</strong> {userId}
          </p>
          <p className="auth-token-preview">
            <strong>Reset token:</strong> {resetToken}
          </p>
          <Link
            className="auth-link-button"
            to={`/reset-password?userId=${userId}&token=${encodeURIComponent(resetToken)}`}
          >
            Continue to Reset Password
          </Link>
        </div>
      ) : null}
    </div>
  )
}

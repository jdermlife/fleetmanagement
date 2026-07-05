import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { confirmPasswordReset, getErrorMessage } from '../../api'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialUserId = useMemo(
    () => searchParams.get('userId') ?? '',
    [searchParams],
  )
  const initialToken = useMemo(
    () => searchParams.get('token') ?? '',
    [searchParams],
  )
  const [userId, setUserId] = useState(initialUserId)
  const [resetToken, setResetToken] = useState(initialToken)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (newPassword !== confirmPassword) {
      setMessage('New password and confirmation password do not match.')
      return
    }

    const parsedUserId = Number.parseInt(userId, 10)
    if (!Number.isFinite(parsedUserId)) {
      setMessage('A valid user ID is required.')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      const response = await confirmPasswordReset(parsedUserId, resetToken, newPassword)
      setMessage(response.message)
      window.setTimeout(() => navigate('/login'), 1200)
    } catch (error) {
      setMessage(getErrorMessage(error, 'Unable to complete password reset right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="standalone-card auth-screen">
      <h1>Reset Password</h1>
      <p className="intro">
        Enter the reset token and choose a new password for your account.
      </p>

      <form className="stack-panel auth-panel" onSubmit={handleSubmit}>
        <label>
          User ID
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            inputMode="numeric"
            required
          />
        </label>

        <label>
          Reset token
          <textarea
            value={resetToken}
            onChange={(event) => setResetToken(event.target.value)}
            placeholder="Paste the reset token here"
            required
          />
        </label>

        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <label>
          Confirm new password
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
            {isSaving ? 'Resetting...' : 'Reset Password'}
          </button>
          <Link className="auth-link-button" to="/login">
            Back to Login
          </Link>
        </div>
      </form>

      {message ? <p className="status-message">{message}</p> : null}

      <div className="auth-support-links">
        <Link to="/subscription-fees">Subscription Fees</Link>
        <Link to="/privacy">Privacy Disclosures</Link>
        <Link to="/terms">Terms & Consent</Link>
      </div>
    </div>
  )
}

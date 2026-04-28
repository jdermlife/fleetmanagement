import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'

import { api, getErrorMessage, setAuthToken } from '../api'
import type { AuthResponse } from '../types'


interface AuthPanelProps {
  bootstrapRequired: boolean
  onAuthenticated: (response: AuthResponse) => void
}


function AuthPanel({ bootstrapRequired, onAuthenticated }: AuthPanelProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [recoveryReason, setRecoveryReason] = useState('')
  const [requiresMfa, setRequiresMfa] = useState(false)
  const [error, setError] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRequestingRecovery, setIsRequestingRecovery] = useState(false)

  const submitLabel = useMemo(
    () => (bootstrapRequired ? 'Create Admin Account' : 'Sign In'),
    [bootstrapRequired],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setRecoveryMessage('')

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters long.')
      return
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.')
      return
    }

    if (bootstrapRequired && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!bootstrapRequired && requiresMfa && !/^\d{6}$/.test(otpCode) && backupCode.trim().length === 0) {
      setError('Enter either the 6-digit MFA code or one of your backup codes.')
      return
    }

    setIsSubmitting(true)

    try {
      const endpoint = bootstrapRequired ? '/auth/bootstrap' : '/auth/login'
      const response = await api.post<AuthResponse>(endpoint, {
        username: trimmedUsername,
        password,
        otpCode: requiresMfa && otpCode ? otpCode : undefined,
        backupCode: requiresMfa && backupCode.trim() ? backupCode.trim() : undefined,
      })
      setAuthToken(response.data.token)
      setRequiresMfa(false)
      setOtpCode('')
      setBackupCode('')
      onAuthenticated(response.data)
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data
        if (
          responseData &&
          typeof responseData === 'object' &&
          'mfaRequired' in responseData &&
          responseData.mfaRequired === true
        ) {
          setRequiresMfa(true)
        }
      }
      setError(
        getErrorMessage(
          error,
          bootstrapRequired
            ? 'Unable to create the initial admin account right now.'
            : 'Unable to sign in with those credentials.',
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRecoveryRequest() {
    setError('')
    setRecoveryMessage('')

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3 || password.length < 10) {
      setError('Enter your username and password before requesting MFA recovery.')
      return
    }

    setIsRequestingRecovery(true)

    try {
      await api.post('/auth/mfa/recovery-request', {
        username: trimmedUsername,
        password,
        reason: recoveryReason.trim(),
      })
      setRecoveryMessage('Recovery request submitted. An admin can now approve your MFA reset.')
      setRecoveryReason('')
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to submit an MFA recovery request right now.'))
    } finally {
      setIsRequestingRecovery(false)
    }
  }

  return (
    <div className="auth-panel">
      <h2>{bootstrapRequired ? 'Bootstrap The First Admin' : 'Sign In'}</h2>
      <p>
        {bootstrapRequired
          ? 'No users exist yet. Create the first administrator account to unlock the app.'
          : 'Sign in to access the protected fleet operations screens.'}
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="fleet-admin"
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 10 characters"
            autoComplete={bootstrapRequired ? 'new-password' : 'current-password'}
            required
          />
        </label>
        {bootstrapRequired ? (
          <label>
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            required
          />
        </label>
        ) : null}
        {!bootstrapRequired && requiresMfa ? (
          <>
            <label>
              MFA Code
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </label>
            <label>
              Backup Code
              <input
                type="text"
                value={backupCode}
                onChange={(event) => setBackupCode(event.target.value.toUpperCase())}
                placeholder="ABCD-1234"
                autoComplete="one-time-code"
              />
            </label>
            <label>
              Recovery Reason
              <textarea
                value={recoveryReason}
                onChange={(event) => setRecoveryReason(event.target.value)}
                placeholder="Optional note for the admin approving your MFA recovery"
              />
            </label>
            <button type="button" onClick={handleRecoveryRequest} disabled={isRequestingRecovery}>
              {isRequestingRecovery ? 'Requesting...' : 'Request MFA Recovery'}
            </button>
          </>
        ) : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : submitLabel}
        </button>
      </form>
      {error ? <p className="status-message status-error">{error}</p> : null}
      {recoveryMessage ? <p className="status-message status-success">{recoveryMessage}</p> : null}
    </div>
  )
}

export default AuthPanel

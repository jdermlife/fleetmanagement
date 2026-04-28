import { useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage, setAuthToken } from '../api'
import type { AuthResponse, AuthUser } from '../types'


interface AccountSecurityPanelProps {
  currentUser: AuthUser
  onUserUpdated: (user: AuthUser) => void
}

type MfaSetupResponse = {
  secret: string
  otpauthUrl: string
}

type MfaConfirmResponse = {
  user: AuthUser
  backupCodes?: string[]
}

type BackupCodeResponse = {
  backupCodes: string[]
}


function AccountSecurityPanel({ currentUser, onUserUpdated }: AccountSecurityPanelProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [mfaSetupPassword, setMfaSetupPassword] = useState('')
  const [mfaDisablePassword, setMfaDisablePassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaOtpAuthUrl, setMfaOtpAuthUrl] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [isProcessingMfa, setIsProcessingMfa] = useState(false)

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setIsSaving(true)

    try {
      const response = await api.post<AuthResponse>('/auth/change-password', {
        currentPassword,
        newPassword,
      })
      setAuthToken(response.data.token)
      onUserUpdated(response.data.user)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccessMessage(`Password updated for ${currentUser.username}.`)
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to change your password right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleMfaSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!mfaSetupPassword) {
      setError('Current password is required to start MFA setup.')
      return
    }

    setIsProcessingMfa(true)

    try {
      const response = await api.post<MfaSetupResponse>('/auth/mfa/setup', {
        currentPassword: mfaSetupPassword,
      })
      setMfaSecret(response.data.secret)
      setMfaOtpAuthUrl(response.data.otpauthUrl)
      setMfaCode('')
      setBackupCodes([])
      setSuccessMessage('Scan the secret below in your authenticator app, then confirm with a 6-digit code.')
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to start MFA setup right now.'))
    } finally {
      setIsProcessingMfa(false)
    }
  }

  async function handleMfaConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!/^\d{6}$/.test(mfaCode)) {
      setError('Enter a valid 6-digit MFA code.')
      return
    }

    setIsProcessingMfa(true)

    try {
      const response = await api.post<MfaConfirmResponse>('/auth/mfa/confirm', {
        otpCode: mfaCode,
      })
      onUserUpdated(response.data.user)
      setBackupCodes(response.data.backupCodes ?? [])
      setMfaSetupPassword('')
      setMfaCode('')
      setMfaSecret('')
      setMfaOtpAuthUrl('')
      setSuccessMessage('MFA is now enabled for your account. Save the backup codes below somewhere safe.')
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to confirm MFA right now.'))
    } finally {
      setIsProcessingMfa(false)
    }
  }

  async function handleBackupRegenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!mfaDisablePassword) {
      setError('Current password is required to regenerate backup codes.')
      return
    }

    if (!/^\d{6}$/.test(mfaCode)) {
      setError('Enter your current 6-digit MFA code to regenerate backup codes.')
      return
    }

    setIsProcessingMfa(true)

    try {
      const response = await api.post<BackupCodeResponse>('/auth/mfa/backup-codes/regenerate', {
        currentPassword: mfaDisablePassword,
        otpCode: mfaCode,
      })
      setBackupCodes(response.data.backupCodes)
      setMfaCode('')
      setSuccessMessage('Backup codes regenerated. The previous backup codes no longer work.')
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to regenerate backup codes right now.'))
    } finally {
      setIsProcessingMfa(false)
    }
  }

  async function handleMfaDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!mfaDisablePassword) {
      setError('Current password is required to disable MFA.')
      return
    }

    if (!/^\d{6}$/.test(mfaCode)) {
      setError('Enter your current 6-digit MFA code to disable MFA.')
      return
    }

    setIsProcessingMfa(true)

    try {
      const response = await api.post<{ user: AuthUser }>('/auth/mfa/disable', {
        currentPassword: mfaDisablePassword,
        otpCode: mfaCode,
      })
      onUserUpdated(response.data.user)
      setMfaDisablePassword('')
      setMfaCode('')
      setMfaSecret('')
      setMfaOtpAuthUrl('')
      setBackupCodes([])
      setSuccessMessage('MFA has been disabled for your account.')
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to disable MFA right now.'))
    } finally {
      setIsProcessingMfa(false)
    }
  }

  return (
    <div className="stack-panel">
      <div>
        <h2>Account Security</h2>
        <p>Change your own password without leaving the app.</p>
        <form onSubmit={handlePasswordChange}>
          <label>
            Current Password
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Confirm New Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>

      <div>
        <h2>Multi-Factor Authentication</h2>
        <p>{currentUser.mfaEnabled ? 'MFA is currently enabled.' : 'MFA is currently disabled.'}</p>

        {!currentUser.mfaEnabled ? (
          <div className="stack-panel">
            <form onSubmit={handleMfaSetup}>
              <label>
                Current Password
                <input
                  type="password"
                  value={mfaSetupPassword}
                  onChange={(event) => setMfaSetupPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" disabled={isProcessingMfa}>
                {isProcessingMfa ? 'Preparing...' : 'Prepare MFA Setup'}
              </button>
            </form>

            {mfaSecret ? (
              <form onSubmit={handleMfaConfirm}>
                <p><strong>Secret:</strong> <code>{mfaSecret}</code></p>
                <p><strong>otpauth URI:</strong> <code>{mfaOtpAuthUrl}</code></p>
                <label>
                  6-Digit Code
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                  />
                </label>
                <button type="submit" disabled={isProcessingMfa}>
                  {isProcessingMfa ? 'Confirming...' : 'Enable MFA'}
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <div className="stack-panel">
            <form onSubmit={handleBackupRegenerate}>
              <label>
                Current Password
                <input
                  type="password"
                  value={mfaDisablePassword}
                  onChange={(event) => setMfaDisablePassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                Current 6-Digit Code
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  required
                />
              </label>
              <button type="submit" disabled={isProcessingMfa}>
                {isProcessingMfa ? 'Regenerating...' : 'Regenerate Backup Codes'}
              </button>
            </form>

            <form onSubmit={handleMfaDisable}>
              <label>
                Current Password
                <input
                  type="password"
                  value={mfaDisablePassword}
                  onChange={(event) => setMfaDisablePassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                Current 6-Digit Code
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  required
                />
              </label>
              <button type="submit" disabled={isProcessingMfa}>
                {isProcessingMfa ? 'Disabling...' : 'Disable MFA'}
              </button>
            </form>
          </div>
        )}

        {backupCodes.length > 0 ? (
          <div>
            <h3>Backup Codes</h3>
            <p>Each code works once. Save them now; they will not be shown again after you leave this screen.</p>
            <div className="backup-code-grid">
              {backupCodes.map((code) => (
                <code key={code} className="backup-code">{code}</code>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="status-message status-error">{error}</p> : null}
      {successMessage ? <p className="status-message status-success">{successMessage}</p> : null}
    </div>
  )
}

export default AccountSecurityPanel

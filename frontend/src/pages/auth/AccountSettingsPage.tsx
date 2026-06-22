import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  changePassword,
  deleteAccount,
  fetchCurrentUser,
  getAuthToken,
  getErrorMessage,
  logout,
  type LoginResponse,
} from '../../api'

export default function AccountSettingsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<LoginResponse['user'] | null>(null)
  const [loadMessage, setLoadMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    const loadCurrentUser = async () => {
      try {
        const currentUser = await fetchCurrentUser()
        setUser(currentUser)
      } catch (error) {
        setLoadMessage(getErrorMessage(error, 'Unable to load account details.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadCurrentUser()
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (newPassword !== confirmPassword) {
      setPasswordMessage('New password and confirmation password do not match.')
      return
    }

    setIsChangingPassword(true)
    setPasswordMessage('')

    try {
      const response = await changePassword(currentPassword, newPassword)
      setPasswordMessage(response.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordMessage(getErrorMessage(error, 'Unable to change password right now.'))
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (deleteConfirmation !== 'DELETE') {
      setDeleteMessage('Type DELETE to confirm account removal.')
      return
    }

    setIsDeletingAccount(true)
    setDeleteMessage('')

    try {
      const response = await deleteAccount(deletePassword)
      setDeleteMessage(response.message)
      await logout()
      window.setTimeout(() => navigate('/login'), 1200)
    } catch (error) {
      setDeleteMessage(getErrorMessage(error, 'Unable to delete the account right now.'))
    } finally {
      setIsDeletingAccount(false)
    }
  }

  if (isLoading) {
    return (
      <div className="standalone-card auth-screen">
        <h1>Account Settings</h1>
        <p>Loading account details...</p>
      </div>
    )
  }

  if (!getAuthToken() || !user) {
    return (
      <div className="standalone-card auth-screen">
        <h1>Account Settings</h1>
        <p className="intro">
          Sign in to view your account details, change your password, or manage your access.
        </p>
        {loadMessage ? <p className="status-message status-error">{loadMessage}</p> : null}
        <div className="form-actions">
          <Link className="auth-link-button" to="/login">
            Go to Login
          </Link>
          <Link className="auth-link-button" to="/forgot-password">
            Forgot Password
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="standalone-card auth-screen">
      <h1>Account Settings</h1>
      <p className="intro">
        Manage your sign-in details, review your account status, and self-serve password updates.
      </p>

      <div className="card auth-helper-card">
        <h3>Account Profile</h3>
        <div className="auth-profile-grid">
          <div>
            <span>Username</span>
            <strong>{user.username}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>{user.role}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{user.isActive ? 'Active' : 'Disabled'}</strong>
          </div>
          <div>
            <span>Last login</span>
            <strong>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'N/A'}</strong>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" onClick={handleLogout}>
            Sign Out
          </button>
          <Link className="auth-link-button" to="/privacy">
            View Privacy Disclosures
          </Link>
          <Link className="auth-link-button" to="/terms">
            View Terms & Consent
          </Link>
        </div>
      </div>

      <form className="card auth-panel" onSubmit={handlePasswordChange}>
        <h3>Change Password</h3>

        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
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
          <button type="submit" disabled={isChangingPassword}>
            {isChangingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>

        {passwordMessage ? <p className="status-message">{passwordMessage}</p> : null}
      </form>

      <form className="card auth-panel auth-danger-panel" onSubmit={handleDeleteAccount}>
        <h3>Delete Account</h3>
        <p className="intro">
          This action disables account access. Type <strong>DELETE</strong> to confirm.
        </p>

        <label>
          Current password
          <input
            type="password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <label>
          Confirmation text
          <input
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            placeholder="Type DELETE"
            required
          />
        </label>

        <div className="form-actions">
          <button className="button-danger" type="submit" disabled={isDeletingAccount}>
            {isDeletingAccount ? 'Disabling...' : 'Delete Account'}
          </button>
        </div>

        {deleteMessage ? <p className="status-message">{deleteMessage}</p> : null}
      </form>
    </div>
  )
}

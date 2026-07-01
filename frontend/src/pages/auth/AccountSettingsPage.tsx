import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  changePassword,
  deleteAccount,
  fetchCurrentUser,
  getAuthToken,
  getErrorMessage,
  listSubscriptionPlans,
  logout,
  type LoginResponse,
  type SubscriptionPlan,
} from '../../api'

type ThemeId = 'classic' | 'civic' | 'philippine-flag'

const THEME_STORAGE_KEY = 'fms:theme'

const themeOptions: Array<{ id: ThemeId; label: string; description: string }> = [
  { id: 'classic', label: 'Classic', description: 'Current gold-based FILSCORE look.' },
  { id: 'civic', label: 'Blue/Red/Yellow/White', description: 'Brighter blue, red, yellow, and white palette.' },
  { id: 'philippine-flag', label: 'Philippine Flag', description: 'Predominantly royal blue and green with yellow highlights and white support tones.' },
]

const isThemeId = (value: string | null): value is ThemeId =>
  value === 'classic' || value === 'civic' || value === 'philippine-flag'

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
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('')
  const [subscriptionMessage, setSubscriptionMessage] = useState('')
  const [theme, setTheme] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') {
      return 'classic'
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeId(savedTheme) ? savedTheme : 'classic'
  })

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    const loadCurrentUser = async () => {
      try {
        const [currentUser, planRows] = await Promise.all([
          fetchCurrentUser(),
          listSubscriptionPlans(),
        ])
        setUser(currentUser)
        setPlans(planRows)
        if (planRows.length > 0) {
          setSelectedPlanId(planRows[0].id)
        }
      } catch (error) {
        setLoadMessage(getErrorMessage(error, 'Unable to load account details.'))
      } finally {
        setIsLoading(false)
      }
    }

    void loadCurrentUser()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

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

  const getMonthlyEquivalent = (plan: SubscriptionPlan): number => {
    if (plan.monthly_price && plan.monthly_price > 0) {
      return plan.monthly_price
    }
    if (plan.yearly_price && plan.yearly_price > 0) {
      return plan.yearly_price / 12
    }
    return 0
  }

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => getMonthlyEquivalent(a) - getMonthlyEquivalent(b)),
    [plans],
  )

  const selectedPlan = useMemo(
    () => sortedPlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [sortedPlans, selectedPlanId],
  )

  const suggestedUpgrade = useMemo(() => {
    if (!selectedPlan) {
      return null
    }
    const selectedPrice = getMonthlyEquivalent(selectedPlan)
    return sortedPlans.find((plan) => getMonthlyEquivalent(plan) > selectedPrice) ?? null
  }, [selectedPlan, sortedPlans])

  const handleGoToPayment = () => {
    if (!selectedPlan) {
      setSubscriptionMessage('Please select a subscription plan first.')
      return
    }
    navigate(`/subscription-payment?planId=${selectedPlan.id}`)
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

      <div className="card auth-helper-card">
        <h3>Subscription Plan</h3>
        <p className="intro">
          Select your preferred plan and proceed to payment for activation or upgrade.
        </p>

        <label>
          Available plans (monthly equivalent)
          <select
            value={selectedPlanId}
            onChange={(event) => setSelectedPlanId(event.target.value ? Number(event.target.value) : '')}
          >
            {sortedPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.plan_name} ({plan.plan_code}) - {plan.currency} {getMonthlyEquivalent(plan).toFixed(2)} / month
              </option>
            ))}
          </select>
        </label>

        {selectedPlan ? (
          <p className="status-message">
            Selected: <strong>{selectedPlan.plan_name}</strong> | Support: <strong>{selectedPlan.support_level}</strong>
          </p>
        ) : null}

        {suggestedUpgrade ? (
          <p className="status-message">
            Upgrade offer: Move to <strong>{suggestedUpgrade.plan_name}</strong> for enhanced features at
            {' '}
            <strong>
              {suggestedUpgrade.currency} {getMonthlyEquivalent(suggestedUpgrade).toFixed(2)} / month
            </strong>
            .
          </p>
        ) : (
          <p className="status-message">You are already on the highest available monthly tier.</p>
        )}

        <div className="form-actions">
          <button type="button" onClick={handleGoToPayment}>
            Go to Payment
          </button>
        </div>

        {subscriptionMessage ? <p className="status-message">{subscriptionMessage}</p> : null}
      </div>

      <div className="card auth-helper-card">
        <h3>Theme Settings</h3>
        <p className="intro">
          Choose which color look the app should use.
        </p>
        <div className="app-theme-grid">
          {themeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`app-theme-button${theme === option.id ? ' app-theme-button-active' : ''}`}
              onClick={() => setTheme(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="status-message">
          Active theme:{' '}
          <strong>{themeOptions.find((option) => option.id === theme)?.label ?? 'Classic'}</strong>
        </p>
        <p className="status-message">
          {themeOptions.find((option) => option.id === theme)?.description}
        </p>
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

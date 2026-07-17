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
  updateAccountPreferences,
  type LoginResponse,
  type SubscriptionPlan,
} from '../../api'
import { prepareAutosavesForLogout } from '../../autosave/useAutosaveDraft'

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
  const [preferencesMessage, setPreferencesMessage] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [lenderDataSharingChoice, setLenderDataSharingChoice] = useState<'share' | 'do_not_share'>(
    'do_not_share',
  )
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
        const currentUser = await fetchCurrentUser()
        setUser(currentUser)
        setLenderDataSharingChoice(currentUser.lenderDataSharingConsent ? 'share' : 'do_not_share')
      } catch (error) {
        setLoadMessage(getErrorMessage(error, 'Unable to load account details.'))
      } finally {
        setIsLoading(false)
      }
    }

    const loadSubscriptionPlans = async () => {
      try {
        setPlans(await listSubscriptionPlans())
      } catch {
        // Subscription-plan access is optional and must not hide an authenticated account.
        setPlans([])
      }
    }

    void loadCurrentUser()
    void loadSubscriptionPlans()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const handleLogout = async () => {
    await prepareAutosavesForLogout()
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
      await prepareAutosavesForLogout()
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
    if (plan.minimum_monthly_fee && plan.minimum_monthly_fee > 0) {
      return plan.minimum_monthly_fee
    }
    return 0
  }

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => getMonthlyEquivalent(a) - getMonthlyEquivalent(b)),
    [plans],
  )

  const currentPlan = useMemo(
    () => sortedPlans.find((plan) => plan.id === user?.subscriptionId) ?? null,
    [sortedPlans, user?.subscriptionId],
  )

  const suggestedUpgrade = useMemo(() => {
    if (!currentPlan) {
      return sortedPlans[0] ?? null
    }

    const selectedPrice = getMonthlyEquivalent(currentPlan)
    return sortedPlans.find((plan) => getMonthlyEquivalent(plan) > selectedPrice) ?? null
  }, [currentPlan, sortedPlans])

  const handleSavePreferences = async () => {
    setIsUpdatingPreferences(true)
    setPreferencesMessage('')

    try {
      const response = await updateAccountPreferences({
        lenderDataSharingConsent: lenderDataSharingChoice === 'share',
      })
      setUser(response.user)
      setPreferencesMessage('Preference saved successfully.')
    } catch (error) {
      setPreferencesMessage(getErrorMessage(error, 'Unable to save your preference right now.'))
    } finally {
      setIsUpdatingPreferences(false)
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

      <div className="card auth-helper-card">
        <h3>Subscription Plan</h3>
        <p className="intro">
          Review your current subscription and use the upgrade link when you are ready to move to a higher plan.
        </p>
        <p className="status-message">
          Current subscription:{' '}
          <strong>
            {currentPlan ? `${currentPlan.plan_name} (${currentPlan.plan_code})` : 'No subscription assigned'}
          </strong>
        </p>
        {currentPlan ? (
          <p className="status-message">
            Support level: <strong>{currentPlan.support_level}</strong> | Monthly equivalent:{' '}
            <strong>
              {currentPlan.currency} {getMonthlyEquivalent(currentPlan).toFixed(2)}
            </strong>
          </p>
        ) : null}
        <p className="status-message">
          {suggestedUpgrade ? (
            <>
              To upgrade, visit{' '}
              <Link to={`/subscription-payment?planId=${suggestedUpgrade.id}`}>
                {suggestedUpgrade.plan_name}
              </Link>
              .
            </>
          ) : (
            <>
              For subscription changes, visit <Link to="/subscription-payment">Subscription Payment</Link>.
            </>
          )}
        </p>
      </div>

      <div className="card auth-helper-card">
        <h3>Lender Offer Preference</h3>
        <p className="intro">
          Choose whether lenders may view your information and score to send offers.
        </p>

        <fieldset className="auth-role-fieldset">
          <legend>Data sharing</legend>
          <div className="auth-role-options">
            <label className="auth-role-option">
              <input
                type="radio"
                name="account-lender-data-sharing"
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
                name="account-lender-data-sharing"
                value="do_not_share"
                checked={lenderDataSharingChoice === 'do_not_share'}
                onChange={() => setLenderDataSharingChoice('do_not_share')}
              />
              <span>
                <strong>Do not share information and score for lender offers</strong>
                <small>Your information is excluded from lender offer matching.</small>
              </span>
            </label>
          </div>
        </fieldset>

        <p className="status-message">
          Last recorded:{' '}
          <strong>
            {user.lenderDataSharingConsentRecordedAt
              ? new Date(user.lenderDataSharingConsentRecordedAt).toLocaleString()
              : 'Not recorded'}
          </strong>
        </p>

        <div className="form-actions">
          <button type="button" onClick={handleSavePreferences} disabled={isUpdatingPreferences}>
            {isUpdatingPreferences ? 'Saving...' : 'Save Preference'}
          </button>
        </div>

        {preferencesMessage ? <p className="status-message">{preferencesMessage}</p> : null}
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

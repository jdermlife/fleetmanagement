import { useEffect, useMemo, useState } from 'react'

import {
  assignAdminUserRoles,
  createAdminUser,
  getErrorMessage,
  listAdminRoles,
  listAdminUsers,
  listSubscriptionPlans,
  listSubscriptions,
  updateAdminUser,
  type AdminRole,
  type AdminUser,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '../../api'
import { useAutosaveDraft } from '../../autosave/useAutosaveDraft'

type AccountStatus = NonNullable<AdminUser['account_status']>

const ACCOUNT_STATUSES: AccountStatus[] = [
  'ACTIVE',
  'PENDING',
  'LOCKED',
  'SUSPENDED',
  'DISABLED',
  'DELETED',
]

function uniqueRoleList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobileNo, setMobileNo] = useState('')
  const [accountStatus, setAccountStatus] = useState<'ACTIVE' | 'PENDING' | 'LOCKED' | 'SUSPENDED' | 'DISABLED' | 'DELETED'>('ACTIVE')
  const [subscriptionId, setSubscriptionId] = useState<number | ''>('')
  const [newUserRoles, setNewUserRoles] = useState('')

  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({})
  const [statusDrafts, setStatusDrafts] = useState<Record<number, AccountStatus>>({})
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<Record<number, number | ''>>({})
  const userFormAutosave = useAutosaveDraft({
    scope: 'admin-user-create',
    entityKey: 'default',
    value: {
      username,
      email,
      firstName,
      middleName,
      lastName,
      mobileNo,
      accountStatus,
      subscriptionId,
      newUserRoles,
    },
    defaults: {
      username: '',
      email: '',
      firstName: '',
      middleName: '',
      lastName: '',
      mobileNo: '',
      accountStatus: 'ACTIVE' as const,
      subscriptionId: '' as number | '',
      newUserRoles: '',
    },
    onHydrate: (draft) => {
      setUsername(draft.username)
      setEmail(draft.email)
      setFirstName(draft.firstName)
      setMiddleName(draft.middleName)
      setLastName(draft.lastName)
      setMobileNo(draft.mobileNo)
      setAccountStatus(draft.accountStatus)
      setSubscriptionId(draft.subscriptionId)
      setNewUserRoles(draft.newUserRoles)
    },
  })

  const loadData = async () => {
    setLoading(true)
    setMessage('')
    try {
      const [loadedUsers, loadedRoles, loadedSubscriptions, loadedSubscriptionPlans] = await Promise.all([
        listAdminUsers(),
        listAdminRoles(),
        listSubscriptions(),
        listSubscriptionPlans(),
      ])
      setUsers(loadedUsers)
      setRoles(loadedRoles)
      setSubscriptions(loadedSubscriptions)
      setSubscriptionPlans(loadedSubscriptionPlans)
      setRoleDrafts(
        Object.fromEntries(loadedUsers.map((user) => [user.id, user.roles.join(', ')])),
      )
      setStatusDrafts(
        Object.fromEntries(
          loadedUsers.map((user) => [
            user.id,
            user.account_status ?? (user.is_active ? 'ACTIVE' : 'DISABLED'),
          ]),
        ),
      )
      setSubscriptionDrafts(
        Object.fromEntries(loadedUsers.map((user) => [user.id, user.subscription_id ?? ''])),
      )
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to load users.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const subscriptionPlanNames = useMemo(() => {
    const planNamesById = new Map(
      subscriptionPlans.map((plan) => [plan.id, plan.plan_name]),
    )

    return new Map(
      subscriptions.map((subscription) => [
        subscription.id,
        planNamesById.get(subscription.plan_id) ?? 'Plan unavailable',
      ]),
    )
  }, [subscriptionPlans, subscriptions])

  const handleCreateUser = async () => {
    setMessage('')
    try {
      await createAdminUser({
        username,
        email,
        password,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        mobile_no: mobileNo,
        account_status: accountStatus,
        subscription_id: subscriptionId ? Number(subscriptionId) : undefined,
        roles: uniqueRoleList(newUserRoles),
      })
      await userFormAutosave.clear()
      setUsername('')
      setEmail('')
      setPassword('')
      setFirstName('')
      setMiddleName('')
      setLastName('')
      setMobileNo('')
      setAccountStatus('ACTIVE')
      setSubscriptionId('')
      setNewUserRoles('')
      await loadData()
      setMessage('User created successfully.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to create user.'))
    }
  }

  const handleSaveUser = async (user: AdminUser) => {
    setMessage('')
    try {
      const accountStatus = statusDrafts[user.id] ?? 'DISABLED'
      const subscriptionId = subscriptionDrafts[user.id]
      await Promise.all([
        assignAdminUserRoles(user.id, uniqueRoleList(roleDrafts[user.id] ?? '')),
        updateAdminUser(user.id, {
          account_status: accountStatus,
          is_active: accountStatus === 'ACTIVE',
          subscription_id: subscriptionId === '' ? null : subscriptionId,
        }),
      ])
      await loadData()
      setMessage('User changes saved successfully.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to save user changes.'))
    }
  }

  const handleToggleStatus = async (user: AdminUser) => {
    setMessage('')
    try {
      const nextActive = !user.is_active
      await updateAdminUser(user.id, {
        is_active: nextActive,
        account_status: nextActive ? 'ACTIVE' : 'DISABLED',
      })
      await loadData()
      setMessage('User status updated.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to update user status.'))
    }
  }

  return (
    <div className="standalone-card">
      <h1>User Management</h1>
      <p className="intro">
        Admin-only user register for account status, access roles, and subscription plans.
      </p>

      {message ? <p className="status-message">{message}</p> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Create User</h3>
        <div className="auth-profile-grid">
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            First Name
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </label>
          <label>
            Middle Name
            <input value={middleName} onChange={(event) => setMiddleName(event.target.value)} />
          </label>
          <label>
            Last Name
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </label>
          <label>
            Mobile No
            <input value={mobileNo} onChange={(event) => setMobileNo(event.target.value)} />
          </label>
          <label>
            Account Status
            <select
              value={accountStatus}
              onChange={(event) =>
                setAccountStatus(
                  event.target.value as 'ACTIVE' | 'PENDING' | 'LOCKED' | 'SUSPENDED' | 'DISABLED' | 'DELETED',
                )
              }
            >
              {ACCOUNT_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Subscription
            <select
              value={subscriptionId}
              onChange={(event) => setSubscriptionId(event.target.value ? Number(event.target.value) : '')}
            >
              <option value="">None</option>
              {subscriptions.map((subscription) => (
                <option key={subscription.id} value={subscription.id}>
                  {subscription.subscription_no} - {subscriptionPlanNames.get(subscription.id) ?? 'Plan unavailable'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Roles (comma-separated)
            <input
              value={newUserRoles}
              onChange={(event) => setNewUserRoles(event.target.value)}
              placeholder="admin, subscriber"
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={() => void handleCreateUser()}>
            Create User
          </button>
        </div>
      </div>

      <div className="card">
        <h3>User Register</h3>
        <p className="intro">Available roles: {roles.map((role) => role.name).join(', ') || 'None'}</p>
        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p className="status-message">No users found.</p>
        ) : (
          <>
            <div className="space-y-4 md:hidden">
              {users.map((user) => (
                <article key={`mobile-${user.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{user.username}</div>
                      <div className="text-xs text-slate-500">
                        {[user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || 'N/A'}
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      {user.account_status ?? (user.is_active ? 'ACTIVE' : 'DISABLED')}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</div>
                      <div className="break-words text-slate-700">{user.email}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Date Created</div>
                      <div className="text-slate-700">{formatDateCreated(user.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin Email Sent</div>
                      <div className="text-slate-700">{formatNotificationSentAt(user.admin_user_notification_sent_at)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</div>
                      <select
                        aria-label={`Status for ${user.username}`}
                        value={statusDrafts[user.id] ?? 'DISABLED'}
                        onChange={(event) =>
                          setStatusDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as AccountStatus,
                          }))
                        }
                      >
                        {ACCOUNT_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Subscription Plan</div>
                      <select
                        aria-label={`Subscription plan for ${user.username}`}
                        value={subscriptionDrafts[user.id] ?? ''}
                        onChange={(event) =>
                          setSubscriptionDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value ? Number(event.target.value) : '',
                          }))
                        }
                      >
                        <option value="">No Subscription</option>
                        {subscriptions.map((subscription) => (
                          <option key={subscription.id} value={subscription.id}>
                            {subscription.subscription_no} - {subscriptionPlanNames.get(subscription.id) ?? 'Plan unavailable'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Role</div>
                      <select
                        aria-label={`Role for ${user.username}`}
                        value={roleDrafts[user.id] ?? ''}
                        onChange={(event) =>
                          setRoleDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                      >
                        <option value="">No Role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void handleSaveUser(user)}>
                      Save Changes
                    </button>
                    <button type="button" onClick={() => void handleToggleStatus(user)}>
                      {user.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </article>
              ))}
            </div>

          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Username</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Date Created</th>
                  <th className="px-3 py-2 text-left">Admin Email Sent</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Subscription Plan</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-2">{user.username}</td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateCreated(user.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatNotificationSentAt(user.admin_user_notification_sent_at)}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Status for ${user.username}`}
                        value={statusDrafts[user.id] ?? 'DISABLED'}
                        onChange={(event) =>
                          setStatusDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as AccountStatus,
                          }))
                        }
                      >
                        {ACCOUNT_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Role for ${user.username}`}
                        value={roleDrafts[user.id] ?? ''}
                        onChange={(event) =>
                          setRoleDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                      >
                        <option value="">No Role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>{role.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Subscription plan for ${user.username}`}
                        value={subscriptionDrafts[user.id] ?? ''}
                        onChange={(event) =>
                          setSubscriptionDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value ? Number(event.target.value) : '',
                          }))
                        }
                      >
                        <option value="">No Subscription</option>
                        {subscriptions.map((subscription) => (
                          <option key={subscription.id} value={subscription.id}>
                            {subscription.subscription_no} - {subscriptionPlanNames.get(subscription.id) ?? 'Plan unavailable'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="form-actions">
                        <button type="button" onClick={() => void handleSaveUser(user)}>
                          Save Changes
                        </button>
                        <button type="button" onClick={() => void handleToggleStatus(user)}>
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}

function formatDateCreated(value?: string): string {
  if (!value) {
    return 'N/A'
  }

  const createdAt = new Date(value)
  if (Number.isNaN(createdAt.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(createdAt)
}

function formatNotificationSentAt(value?: string | null): string {
  if (!value) {
    return 'Pending/Failed'
  }

  const sentAt = new Date(value)
  if (Number.isNaN(sentAt.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Manila',
    timeZoneName: 'short',
  }).format(sentAt)
}

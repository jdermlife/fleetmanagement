import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage } from '../api'
import type { MfaRecoveryRequest, UserAccount, UserRole } from '../types'


const initialUserForm = {
  username: '',
  password: '',
  role: 'viewer' as UserRole,
}

const initialResetForm = {
  userId: '',
  newPassword: '',
}


interface AccessControlPanelProps {
  currentUserId: number
}


function AccessControlPanel({ currentUserId }: AccessControlPanelProps) {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [recoveryRequests, setRecoveryRequests] = useState<MfaRecoveryRequest[]>([])
  const [userForm, setUserForm] = useState(initialUserForm)
  const [resetForm, setResetForm] = useState(initialResetForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [busyUserId, setBusyUserId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    void loadUsers()
  }, [])

  async function loadUsers() {
    setIsLoading(true)
    setError('')

    try {
      const [usersResponse, requestsResponse] = await Promise.all([
        api.get<UserAccount[]>('/users'),
        api.get<MfaRecoveryRequest[]>('/users/mfa-recovery-requests'),
      ])
      setUsers(sortUsers(usersResponse.data))
      setRecoveryRequests(requestsResponse.data)
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to load users right now.'))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (userForm.username.trim().length < 3) {
      setError('Username must be at least 3 characters long.')
      return
    }

    if (userForm.password.length < 10) {
      setError('Password must be at least 10 characters long.')
      return
    }

    setIsSaving(true)

    try {
      const response = await api.post<UserAccount>('/users', {
        username: userForm.username.trim(),
        password: userForm.password,
        role: userForm.role,
      })
      setUsers((currentUsers) => sortUsers([...currentUsers, response.data]))
      setUserForm(initialUserForm)
      setSuccessMessage(`Created ${response.data.username} with ${response.data.role} access.`)
      setResetForm((current) => ({
        ...current,
        userId: current.userId || String(response.data.id),
      }))
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to create that user right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!resetForm.userId) {
      setError('Choose a user before resetting a password.')
      return
    }

    if (resetForm.newPassword.length < 10) {
      setError('Reset passwords must be at least 10 characters long.')
      return
    }

    setIsSaving(true)

    try {
      const response = await api.post<UserAccount>(`/users/${resetForm.userId}/reset-password`, {
        newPassword: resetForm.newPassword,
      })
      setUsers((currentUsers) => replaceUser(currentUsers, response.data))
      setResetForm(initialResetForm)
      setSuccessMessage(`Password reset for ${response.data.username}. Existing sessions were revoked.`)
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to reset that password right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleActive(user: UserAccount) {
    const action = user.isActive ? 'deactivate' : 'reactivate'
    const confirmationMessage = user.isActive
      ? `Deactivate ${user.username}? Their sessions will be revoked.`
      : `Reactivate ${user.username}?`
    if (!window.confirm(confirmationMessage)) {
      return
    }

    setBusyUserId(user.id)
    setError('')
    setSuccessMessage('')

    try {
      const response = await api.post<UserAccount>(`/users/${user.id}/${action}`)
      setUsers((currentUsers) => replaceUser(currentUsers, response.data))
      setSuccessMessage(
        user.isActive
          ? `${user.username} is now inactive and cannot sign in.`
          : `${user.username} has been reactivated.`,
      )
    } catch (error: unknown) {
      setError(getErrorMessage(error, `Unable to ${action} that user right now.`))
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleMfaRecovery(user: UserAccount) {
    if (!window.confirm(`Clear MFA and backup codes for ${user.username}? Existing sessions will be revoked.`)) {
      return
    }

    setBusyUserId(user.id)
    setError('')
    setSuccessMessage('')

    try {
      const response = await api.post<UserAccount>(`/users/${user.id}/mfa/recover`)
      setUsers((currentUsers) => replaceUser(currentUsers, response.data))
      setSuccessMessage(`Cleared MFA recovery settings for ${user.username}.`)
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Unable to recover that user MFA setup right now.'))
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleRecoveryRequestAction(request: MfaRecoveryRequest, action: 'approve' | 'reject') {
    const confirmationMessage =
      action === 'approve'
        ? `Approve MFA recovery for ${request.username}? This clears their MFA and backup codes.`
        : `Reject MFA recovery for ${request.username}?`
    if (!window.confirm(confirmationMessage)) {
      return
    }

    setBusyUserId(request.userId)
    setError('')
    setSuccessMessage('')

    try {
      const response = await api.post<MfaRecoveryRequest>(`/users/mfa-recovery-requests/${request.id}/${action}`)
      setRecoveryRequests((currentRequests) =>
        currentRequests.map((currentRequest) => (currentRequest.id === request.id ? response.data : currentRequest)),
      )
      if (action === 'approve') {
        setUsers((currentUsers) =>
          currentUsers.map((user) =>
            user.id === request.userId
              ? { ...user, mfaEnabled: false }
              : user,
          ),
        )
      }
      setSuccessMessage(
        action === 'approve'
          ? `Approved MFA recovery for ${request.username}.`
          : `Rejected MFA recovery for ${request.username}.`,
      )
    } catch (error: unknown) {
      setError(getErrorMessage(error, `Unable to ${action} that recovery request right now.`))
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div>
      <h2>Access Control</h2>
      <div className="card access-grid">
        <div>
          <h3>Existing Users</h3>
          {isLoading ? (
            <p>Loading users...</p>
          ) : users.length === 0 ? (
            <p className="empty-state">No users found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>MFA</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.role}</td>
                      <td>{user.isActive ? 'Active' : `Inactive${user.deactivatedAt ? ` (${user.deactivatedAt})` : ''}`}</td>
                      <td>{user.mfaEnabled ? 'Enabled' : 'Disabled'}</td>
                      <td>{user.createdAt}</td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          disabled={busyUserId === user.id || user.id === currentUserId}
                        >
                          {busyUserId === user.id
                            ? 'Saving...'
                            : user.isActive
                              ? user.id === currentUserId
                                ? 'Current Admin'
                                : 'Deactivate'
                              : 'Reactivate'}
                        </button>
                        {user.mfaEnabled ? (
                          <button
                            type="button"
                            onClick={() => handleMfaRecovery(user)}
                            disabled={busyUserId === user.id || user.id === currentUserId}
                          >
                            {busyUserId === user.id ? 'Saving...' : user.id === currentUserId ? 'Own MFA' : 'Recover MFA'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="stack-panel">
          <div>
            <h3>Create A User</h3>
            <form onSubmit={handleCreateUser}>
              <label>
                Username
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </label>
              <label>
                Role
                <select
                  value={userForm.role}
                  onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>

          <div>
            <h3>Reset A Password</h3>
            <form onSubmit={handleResetPassword}>
              <label>
                User
                <select
                  value={resetForm.userId}
                  onChange={(event) => setResetForm((current) => ({ ...current, userId: event.target.value }))}
                  required
                >
                  <option value="">Choose a user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                New Password
                <input
                  type="password"
                  value={resetForm.newPassword}
                  onChange={(event) => setResetForm((current) => ({ ...current, newPassword: event.target.value }))}
                  required
                />
              </label>
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>MFA Recovery Requests</h3>
        {isLoading ? (
          <p>Loading recovery requests...</p>
        ) : recoveryRequests.length === 0 ? (
          <p className="empty-state">No MFA recovery requests have been submitted.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Processed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recoveryRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.username}</td>
                    <td>{request.role}</td>
                    <td>{request.reason || '-'}</td>
                    <td>{request.status}</td>
                    <td>{request.requestedAt}</td>
                    <td>
                      {request.processedAt
                        ? `${request.processedAt}${request.processedByUsername ? ` by ${request.processedByUsername}` : ''}`
                        : '-'}
                    </td>
                    <td className="actions-cell">
                      {request.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRecoveryRequestAction(request, 'approve')}
                            disabled={busyUserId === request.userId}
                          >
                            {busyUserId === request.userId ? 'Saving...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            className="button-danger"
                            onClick={() => handleRecoveryRequestAction(request, 'reject')}
                            disabled={busyUserId === request.userId}
                          >
                            {busyUserId === request.userId ? 'Saving...' : 'Reject'}
                          </button>
                        </>
                      ) : (
                        <span>{request.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error ? <p className="status-message status-error">{error}</p> : null}
      {successMessage ? <p className="status-message status-success">{successMessage}</p> : null}
    </div>
  )
}


function sortUsers(users: UserAccount[]) {
  return [...users].sort((a, b) => a.username.localeCompare(b.username))
}


function replaceUser(users: UserAccount[], updatedUser: UserAccount) {
  return sortUsers(users.map((user) => (user.id === updatedUser.id ? updatedUser : user)))
}


export default AccessControlPanel

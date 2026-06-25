import { useEffect, useState } from 'react'

import {
  assignAdminUserRoles,
  createAdminUser,
  getErrorMessage,
  listAdminRoles,
  listAdminUsers,
  updateAdminUser,
  type AdminRole,
  type AdminUser,
} from '../../api'

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
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newUserRoles, setNewUserRoles] = useState('')

  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({})

  const loadData = async () => {
    setLoading(true)
    setMessage('')
    try {
      const [loadedUsers, loadedRoles] = await Promise.all([
        listAdminUsers(),
        listAdminRoles(),
      ])
      setUsers(loadedUsers)
      setRoles(loadedRoles)
      setRoleDrafts(
        Object.fromEntries(loadedUsers.map((user) => [user.id, user.roles.join(', ')])),
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

  const handleCreateUser = async () => {
    setMessage('')
    try {
      await createAdminUser({
        username,
        email,
        password,
        roles: uniqueRoleList(newUserRoles),
      })
      setUsername('')
      setEmail('')
      setPassword('')
      setNewUserRoles('')
      await loadData()
      setMessage('User created successfully.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to create user.'))
    }
  }

  const handleSaveRoles = async (userId: number) => {
    setMessage('')
    try {
      await assignAdminUserRoles(userId, uniqueRoleList(roleDrafts[userId] ?? ''))
      await loadData()
      setMessage('Roles updated successfully.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to update roles.'))
    }
  }

  const handleToggleStatus = async (user: AdminUser) => {
    setMessage('')
    try {
      await updateAdminUser(user.id, { is_active: !user.is_active })
      await loadData()
      setMessage('User status updated.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to update user status.'))
    }
  }

  return (
    <div className="standalone-card">
      <h1>User Management</h1>
      <p className="intro">Create users, enable or disable accounts, and assign roles.</p>

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
        <h3>Users</h3>
        <p className="intro">Available roles: {roles.map((role) => role.name).join(', ') || 'None'}</p>
        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Username</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Roles</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-2">{user.username}</td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{user.is_active ? 'Active' : 'Disabled'}</td>
                    <td className="px-3 py-2">
                      <input
                        value={roleDrafts[user.id] ?? ''}
                        onChange={(event) =>
                          setRoleDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="form-actions">
                        <button type="button" onClick={() => void handleSaveRoles(user.id)}>
                          Save Roles
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
        )}
      </div>
    </div>
  )
}

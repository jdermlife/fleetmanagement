import { useEffect, useState } from 'react'

import {
  assignRolePermissions,
  createAdminRole,
  getErrorMessage,
  listAdminPermissions,
  listAdminRoles,
  type AdminPermission,
  type AdminRole,
} from '../../api'

function splitCsv(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [permissions, setPermissions] = useState<AdminPermission[]>([])
  const [permissionDrafts, setPermissionDrafts] = useState<Record<number, string>>({})
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    setMessage('')
    try {
      const [loadedRoles, loadedPermissions] = await Promise.all([
        listAdminRoles(),
        listAdminPermissions(),
      ])
      setRoles(loadedRoles)
      setPermissions(loadedPermissions)
      setPermissionDrafts(
        Object.fromEntries(
          loadedRoles.map((role) => [
            role.id,
            role.permissions.map((permission) => permission.name).join(', '),
          ]),
        ),
      )
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to load roles.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleCreateRole = async () => {
    setMessage('')
    try {
      await createAdminRole({ name, description })
      setName('')
      setDescription('')
      await loadData()
      setMessage('Role created successfully.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to create role.'))
    }
  }

  const handleAssignPermissions = async (roleId: number) => {
    setMessage('')
    try {
      await assignRolePermissions(roleId, splitCsv(permissionDrafts[roleId] ?? ''))
      await loadData()
      setMessage('Permissions updated.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to assign permissions.'))
    }
  }

  return (
    <div className="standalone-card">
      <h1>Admin Role Management</h1>
      <p className="intro">Create roles and map role permissions.</p>
      {message ? <p className="status-message">{message}</p> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Create Role</h3>
        <div className="auth-profile-grid">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Description
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={() => void handleCreateRole()}>
            Create Role
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Roles</h3>
        <p className="intro">
          Available permissions: {permissions.map((permission) => permission.name).join(', ') || 'None'}
        </p>

        {loading ? (
          <p>Loading roles...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Permissions</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td className="px-3 py-2">{role.name}</td>
                    <td className="px-3 py-2">{role.description || '-'}</td>
                    <td className="px-3 py-2">
                      <input
                        value={permissionDrafts[role.id] ?? ''}
                        onChange={(event) =>
                          setPermissionDrafts((prev) => ({ ...prev, [role.id]: event.target.value }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => void handleAssignPermissions(role.id)}>
                        Save Permissions
                      </button>
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

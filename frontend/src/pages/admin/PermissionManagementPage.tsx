import { useEffect, useState } from 'react'

import {
  createAdminPermission,
  getErrorMessage,
  listAdminPermissions,
  type AdminPermission,
} from '../../api'
import { useAutosaveDraft } from '../../autosave/useAutosaveDraft'

export default function PermissionManagementPage() {
  const [permissions, setPermissions] = useState<AdminPermission[]>([])
  const [name, setName] = useState('')
  const [resource, setResource] = useState('')
  const [action, setAction] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const permissionFormAutosave = useAutosaveDraft({
    scope: 'admin-permission-create',
    entityKey: 'default',
    value: { name, resource, action, description },
    defaults: { name: '', resource: '', action: '', description: '' },
    onHydrate: (draft) => {
      setName(draft.name)
      setResource(draft.resource)
      setAction(draft.action)
      setDescription(draft.description)
    },
  })

  const loadData = async () => {
    setLoading(true)
    setMessage('')
    try {
      const data = await listAdminPermissions()
      setPermissions(data)
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to load permissions.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleCreatePermission = async () => {
    setMessage('')
    try {
      await createAdminPermission({ name, resource, action, description })
      await permissionFormAutosave.clear()
      setName('')
      setResource('')
      setAction('')
      setDescription('')
      await loadData()
      setMessage('Permission created successfully.')
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to create permission.'))
    }
  }

  return (
    <div className="standalone-card">
      <h1>Permission Management</h1>
      <p className="intro">Define permission keys and resource/action scopes.</p>
      {message ? <p className="status-message">{message}</p> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Create Permission</h3>
        <div className="auth-profile-grid">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="read:loan_applications" />
          </label>
          <label>
            Resource
            <input value={resource} onChange={(event) => setResource(event.target.value)} placeholder="loan_applications" />
          </label>
          <label>
            Action
            <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="read" />
          </label>
          <label>
            Description
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={() => void handleCreatePermission()}>
            Create Permission
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Permissions</h3>
        {loading ? (
          <p>Loading permissions...</p>
        ) : (
          <>
          <div className="space-y-4 md:hidden">
            {permissions.map((permission) => (
              <article key={`mobile-${permission.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">{permission.name}</div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Resource</div>
                    <div className="text-slate-700 break-words">{permission.resource}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Action</div>
                    <div className="text-slate-700">{permission.action}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</div>
                    <div className="text-slate-700">{permission.description || '-'}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Resource</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((permission) => (
                  <tr key={permission.id}>
                    <td className="px-3 py-2">{permission.name}</td>
                    <td className="px-3 py-2">{permission.resource}</td>
                    <td className="px-3 py-2">{permission.action}</td>
                    <td className="px-3 py-2">{permission.description || '-'}</td>
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

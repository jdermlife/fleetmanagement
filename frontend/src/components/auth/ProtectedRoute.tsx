import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuthorization } from '../../hooks/useAuthorization'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: string[]
  permissions?: string[]
}

export default function ProtectedRoute({
  children,
  roles = [],
  permissions = [],
}: ProtectedRouteProps) {
  const location = useLocation()
  const { isLoading, isAuthenticated, hasAnyRole, hasAnyPermission } = useAuthorization()

  if (isLoading) {
    return <div className="card">Checking access...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (!hasAnyRole(roles) || !hasAnyPermission(permissions)) {
    return (
      <div className="card">
        <h2>Access denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

  return <>{children}</>
}

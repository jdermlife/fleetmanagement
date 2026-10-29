import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

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
        <h2>Please Upgrade Your Subscription</h2>
        <p>This page is for Multiple Applications</p>
        <Link className="auth-link-button" to="/subscription/payment?plan=multiple">
          Upgrade Subscription
        </Link>
      </div>
    )
  }

  return <>{children}</>
}

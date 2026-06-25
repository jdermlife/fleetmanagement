import type { ReactNode } from 'react'

import { useAuthorization } from '../../hooks/useAuthorization'

interface AuthorizeProps {
  children: ReactNode
  roles?: string[]
  permissions?: string[]
  fallback?: ReactNode
}

export default function Authorize({
  children,
  roles = [],
  permissions = [],
  fallback = null,
}: AuthorizeProps) {
  const { isLoading, hasAnyRole, hasAnyPermission } = useAuthorization()

  if (isLoading) {
    return <>{fallback}</>
  }

  if (!hasAnyRole(roles) || !hasAnyPermission(permissions)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

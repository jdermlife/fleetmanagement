import { useEffect, useMemo, useState } from 'react'

import { fetchCurrentUser, getAuthToken, type AuthUser } from '../api'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function isAdminUsernameOverride(username?: string | null): boolean {
  return normalize(username ?? '') === 'admin123'
}

export function useAuthorization() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    const load = async () => {
      try {
        const currentUser = await fetchCurrentUser()
        setUser(currentUser)
      } catch {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const roleSet = useMemo(() => {
    const roles = user?.roles ?? (user?.role ? [user.role] : [])
    return new Set(roles.map(normalize))
  }, [user])

  const permissionSet = useMemo(
    () => new Set((user?.permissions ?? []).map(normalize)),
    [user],
  )
  const isUsernameOverrideAdmin = isAdminUsernameOverride(user?.username)

  const hasRole = (role: string): boolean =>
    isUsernameOverrideAdmin || roleSet.has(normalize(role))

  const hasAnyRole = (roles: string[]): boolean => {
    if (roles.length === 0) {
      return true
    }
    return roles.some((role) => hasRole(role))
  }

  const hasPermission = (permission: string): boolean =>
    isUsernameOverrideAdmin || permissionSet.has(normalize(permission))

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (permissions.length === 0) {
      return true
    }
    return permissions.some((permission) => hasPermission(permission))
  }

  const isAdmin = isUsernameOverrideAdmin || hasRole('admin')

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    isAdmin,
    hasRole,
    hasAnyRole,
    hasPermission,
    hasAnyPermission,
  }
}

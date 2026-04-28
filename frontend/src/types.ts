export type UserRole = 'admin' | 'manager' | 'viewer'

export interface AuthUser {
  id: number
  username: string
  role: UserRole
  isActive: boolean
  mfaEnabled: boolean
  deactivatedAt: string | null
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface BootstrapStatus {
  requiresBootstrap: boolean
}

export interface Vehicle {
  id: number
  make: string
  model: string
  year: number
  createdAt: string
  updatedAt: string
}

export interface NewVehicle {
  make: string
  model: string
  year: number
}

export interface FuelLog {
  id: number
  date: string
  vehicle: string
  fuelCard: string
  liters: number
  amount: number
  notes: string
  theftSuspected: boolean
  abnormalRefill: boolean
  createdAt: string
  updatedAt: string
}

export interface NewFuelLog {
  date: string
  vehicle: string
  fuelCard: string
  liters: number
  amount: number
  notes: string
  theftSuspected: boolean
  abnormalRefill: boolean
}

export interface UserAccount {
  id: number
  username: string
  role: UserRole
  isActive: boolean
  mfaEnabled: boolean
  deactivatedAt: string | null
  createdAt: string
}

export interface AuditLog {
  id: number
  action: string
  entityType: string
  entityId: number | null
  details: string
  createdAt: string
  actorUsername: string | null
  actorRole: UserRole | null
}

export interface MfaRecoveryRequest {
  id: number
  userId: number
  username: string
  role: UserRole
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  requestedAt: string
  processedAt: string | null
  processedByUsername: string | null
}

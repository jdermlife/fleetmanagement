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

export interface AuditLog {
  id: number
  action: string
  entityType: string
  entityId: number | null
  details: string
  createdAt: string
  actorUsername: string | null
  actorRole: string | null
}

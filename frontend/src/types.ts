export interface Vehicle {
  id: number
  make: string
  model: string
  year: number
  createdAt: string
  updatedAt: string
}

export interface LiveGpsVehicleStatus extends Vehicle {
  latitude: number
  longitude: number
  speedKph: number
  heading: string
  status: 'moving' | 'idle' | 'stopped'
  lastUpdateLabel: string
  routeLabel: string
  geofence: string
}

export interface NewVehicle {
  make: string
  model: string
  year: number
}

export interface DatabaseStatus {
  engine: string
  connected: boolean
  database: string | null
  host: string | null
  port: number | null
  source: string
}

export interface LeaseScorecardSubmission {
  customerName: string
  companyName: string
  vehicleType: string
  vehicleValue: number
  downPayment: number
  requestedAmount: number
  monthlyIncome: number
  existingDebt: number
  leaseTermMonths: number
  creditScore: number
  yearsInBusiness: number
  employmentYears: number
}

export interface LeaseScorecardRecord extends LeaseScorecardSubmission {
  id: number
  monthlyEstimatedPayment: number
  debtServiceRatio: number
  loanToValue: number
  creditComponent: number
  affordabilityComponent: number
  equityComponent: number
  stabilityComponent: number
  assetComponent: number
  finalScore: number
  riskGrade: string
  decision: string
  summary: string
  createdAt: string
}

export interface DriverManagementScorecardSubmission {
  driverName: string
  licenseClass: string
  yearsDriving: number
  employmentYears: number
  incidentsLast3Years: number
  violationsLast3Years: number
  trainingHours: number
  onTimeRate: number
  customerRating: number
  fatigueEvents: number
}

export interface DriverManagementScorecardRecord extends DriverManagementScorecardSubmission {
  id: number
  safetyComponent: number
  complianceComponent: number
  experienceComponent: number
  serviceComponent: number
  stabilityComponent: number
  finalScore: number
  riskGrade: string
  recommendation: string
  summary: string
  createdAt: string
}

export interface DriverRegistrationSubmission {
  firstName: string
  lastName: string
  licenseNumber: string
  phone: string
  email: string
  status: string
}

export interface DriverRegistrationRecord extends DriverRegistrationSubmission {
  id: number
  createdAt: string
}

export interface MaintenanceRecordSubmission {
  vehicleId: number | null
  vehicleLabel: string
  maintenanceType: string
  serviceDate: string
  nextServiceDate: string | null
  odometerKm: number
  vendor: string
  estimatedCost: number
  status: string
  notes: string
}

export interface MaintenanceRecord extends MaintenanceRecordSubmission {
  id: number
  createdAt: string
}

export interface InsuranceRecordSubmission {
  vehicleId: number | null
  vehicleLabel: string
  provider: string
  policyNumber: string
  coverageType: string
  premiumAmount: number
  insuredValue: number
  startDate: string
  endDate: string
  status: string
  contactPerson: string
  notes: string
}

export interface InsuranceRecord extends InsuranceRecordSubmission {
  id: number
  createdAt: string
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

export interface GpsTrackingRecord {
  id: number
  vehicleId: number | null
  vehicleLabel: string
  latitude: number
  longitude: number
  speedKph: number
  heading: string
  status: string
  routeLabel: string
  geofence: string
  recordedAt: string
  createdAt: string
}

export interface GpsTrackingSubmission {
  vehicleId: number | null
  vehicleLabel: string
  latitude: number
  longitude: number
  speedKph: number
  heading: string
  status: string
  routeLabel: string
  geofence: string
}

import { api } from '../api'
import type { DriverRegistrationRecord, DriverRegistrationSubmission } from '../types'

export async function fetchDrivers(): Promise<DriverRegistrationRecord[]> {
  const response = await api.get<DriverRegistrationRecord[]>('/drivers')
  return response.data
}

export async function createDriver(
  driver: DriverRegistrationSubmission,
): Promise<DriverRegistrationRecord> {
  const response = await api.post<DriverRegistrationRecord>('/drivers', driver)
  return response.data
}
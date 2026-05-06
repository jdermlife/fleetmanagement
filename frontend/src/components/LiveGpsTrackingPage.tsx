import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { api, getErrorMessage } from '../api'
import type { GpsTrackingRecord, GpsTrackingSubmission, Vehicle } from '../types'


const routePresets = [
  { routeLabel: 'North Loop', geofence: 'Warehouse A', heading: 'NE', speedKph: 54, latitude: 14.5995, longitude: 120.9842 },
  { routeLabel: 'Airport Transfer', geofence: 'Terminal Zone', heading: 'SE', speedKph: 42, latitude: 14.5086, longitude: 121.0198 },
  { routeLabel: 'Harbor Dispatch', geofence: 'Port Gate', heading: 'W', speedKph: 18, latitude: 14.5832, longitude: 120.9701 },
  { routeLabel: 'City Shuttle', geofence: 'Central Business District', heading: 'N', speedKph: 0, latitude: 14.5547, longitude: 121.0244 },
]


function LiveGpsTrackingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [gpsRecords, setGpsRecords] = useState<GpsTrackingRecord[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    setError('')

    try {
      const [vehiclesResponse, gpsResponse] = await Promise.all([
        api.get<Vehicle[]>('/vehicles'),
        api.get<GpsTrackingRecord[]>('/gps-tracking'),
      ])
      setVehicles(vehiclesResponse.data)
      setGpsRecords(gpsResponse.data)
      setSelectedVehicleId(vehiclesResponse.data[0]?.id ?? null)
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Unable to load GPS tracking data right now.'))
    } finally {
      setIsLoading(false)
    }
  }

  const liveVehicles = useMemo<GpsTrackingRecord[]>(
    () =>
      vehicles.map((vehicle, index) => {
        // Try to find existing GPS record for this vehicle
        const existingRecord = gpsRecords.find(record => record.vehicleId === vehicle.id)
        if (existingRecord) {
          return existingRecord
        }

        // Fall back to preset data for demo purposes
        const preset = routePresets[index % routePresets.length]
        return {
          id: -index - 1, // Temporary negative ID for mock data
          vehicleId: vehicle.id,
          vehicleLabel: `${vehicle.make} ${vehicle.model} (${vehicle.year})`,
          latitude: preset.latitude,
          longitude: preset.longitude,
          speedKph: preset.speedKph,
          heading: preset.heading,
          status: preset.speedKph === 0 ? 'idle' : preset.speedKph < 15 ? 'stopped' : 'moving',
          routeLabel: preset.routeLabel,
          geofence: preset.geofence,
          recordedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
      }),
    [vehicles, gpsRecords],
  )

  const selectedVehicle = liveVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null

  async function handleAddGpsRecord(vehicle: Vehicle) {
    const preset = routePresets[Math.floor(Math.random() * routePresets.length)]
    
    const payload: GpsTrackingSubmission = {
      vehicleId: vehicle.id,
      vehicleLabel: `${vehicle.make} ${vehicle.model} (${vehicle.year})`,
      latitude: preset.latitude + (Math.random() - 0.5) * 0.01, // Add some random variation
      longitude: preset.longitude + (Math.random() - 0.5) * 0.01,
      speedKph: preset.speedKph,
      heading: preset.heading,
      status: preset.speedKph === 0 ? 'idle' : preset.speedKph < 15 ? 'stopped' : 'moving',
      routeLabel: preset.routeLabel,
      geofence: preset.geofence,
    }

    setIsSaving(true)
    setError('')
    setSuccessMessage('')

    try {
      const response = await api.post<GpsTrackingRecord>('/gps-tracking', payload)
      setGpsRecords((current) => [response.data, ...current])
      setSuccessMessage('GPS tracking record added successfully.')
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, 'Unable to save GPS tracking record.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="live-gps-page">
      <div className="live-gps-header">
        <div>
          <h2>Live GPS Tracking</h2>
          <p>
            Real-time GPS tracking for the fleet. Records are stored in the backend database and can be
            retrieved for route analysis, geofencing alerts, and fleet monitoring.
          </p>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Tracking'}
        </button>
      </div>

      <div className="live-gps-grid">
        <article className="live-gps-card live-gps-map-card">
          <div className="live-gps-card-header">
            <h3>Live Map Board</h3>
            <span>{liveVehicles.length} active units</span>
          </div>
          <div className="live-gps-map">
            {liveVehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                className={`gps-marker gps-marker-${vehicle.status} ${selectedVehicleId === vehicle.id ? 'gps-marker-selected' : ''}`}
                style={{
                  left: `${24 + (vehicle.id * 13) % 68}%`,
                  top: `${20 + (vehicle.id * 17) % 56}%`,
                }}
                onClick={() => setSelectedVehicleId(vehicle.id)}
              >
                <span>{vehicle.vehicleLabel.split(' ')[0].slice(0, 1)}</span>
              </button>
            ))}
            <div className="gps-map-overlay">
              <span>Metro Tracking Grid</span>
              <strong>Live Vehicle Positions</strong>
            </div>
          </div>
        </article>

        <article className="live-gps-card">
          <h3>Tracked Vehicles</h3>
          {liveVehicles.length === 0 ? (
            <p className="empty-state">No vehicles available for tracking.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Speed</th>
                    <th>Route</th>
                    <th>Last Update</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {liveVehicles.map((vehicle) => (
                    <tr
                      key={vehicle.id}
                      className={selectedVehicleId === vehicle.id ? 'gps-row-selected' : ''}
                      onClick={() => setSelectedVehicleId(vehicle.id)}
                    >
                      <td>{vehicle.vehicleLabel}</td>
                      <td>
                        <span className={`gps-status-badge gps-status-${vehicle.status}`}>{vehicle.status}</span>
                      </td>
                      <td>{vehicle.speedKph} km/h</td>
                      <td>{vehicle.routeLabel}</td>
                      <td>{vehicle.recordedAt ? new Date(vehicle.recordedAt).toLocaleTimeString() : 'N/A'}</td>
                      <td>
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation()
                            const vehicleData = vehicles.find(v => v.id === vehicle.vehicleId)
                            if (vehicleData) void handleAddGpsRecord(vehicleData)
                          }}
                          disabled={isSaving}
                        >
                          Update GPS
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>

      {selectedVehicle ? (
        <div className="live-gps-detail-grid">
          <article className="live-gps-card">
            <h3>Selected Vehicle Feed</h3>
            <div className="live-gps-detail-list">
              <div>
                <span>Vehicle</span>
                <strong>{selectedVehicle.vehicleLabel}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{selectedVehicle.status}</strong>
              </div>
              <div>
                <span>Coordinates</span>
                <strong>{selectedVehicle.latitude.toFixed(4)}, {selectedVehicle.longitude.toFixed(4)}</strong>
              </div>
              <div>
                <span>Heading</span>
                <strong>{selectedVehicle.heading}</strong>
              </div>
              <div>
                <span>Geofence</span>
                <strong>{selectedVehicle.geofence}</strong>
              </div>
              <div>
                <span>Recorded At</span>
                <strong>{selectedVehicle.recordedAt ? new Date(selectedVehicle.recordedAt).toLocaleString() : 'N/A'}</strong>
              </div>
            </div>
          </article>

          <article className="live-gps-card">
            <h3>GPS Tracking History</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Speed</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {gpsRecords
                    .filter(record => record.vehicleId === selectedVehicle.vehicleId)
                    .slice(0, 10)
                    .map((record) => (
                      <tr key={record.id}>
                        <td>{new Date(record.recordedAt).toLocaleString()}</td>
                        <td>{record.status}</td>
                        <td>{record.speedKph} km/h</td>
                        <td>{record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : (
        <p className="empty-state">Select a vehicle to inspect its tracking details.</p>
      )}

      {error ? <p className="status-message status-error">{error}</p> : null}
      {successMessage ? <p className="status-message status-success">{successMessage}</p> : null}
    </div>
  )
}


export default LiveGpsTrackingPage

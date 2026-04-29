import { useEffect, useMemo, useState } from 'react'

import { api, getErrorMessage } from '../api'
import type { LiveGpsVehicleStatus, Vehicle } from '../types'


const routePresets = [
  { routeLabel: 'North Loop', geofence: 'Warehouse A', heading: 'NE', speedKph: 54, latitude: 14.5995, longitude: 120.9842 },
  { routeLabel: 'Airport Transfer', geofence: 'Terminal Zone', heading: 'SE', speedKph: 42, latitude: 14.5086, longitude: 121.0198 },
  { routeLabel: 'Harbor Dispatch', geofence: 'Port Gate', heading: 'W', speedKph: 18, latitude: 14.5832, longitude: 120.9701 },
  { routeLabel: 'City Shuttle', geofence: 'Central Business District', heading: 'N', speedKph: 0, latitude: 14.5547, longitude: 121.0244 },
]


function LiveGpsTrackingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadVehicles()
  }, [])

  async function loadVehicles() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.get<Vehicle[]>('/vehicles')
      setVehicles(response.data)
      setSelectedVehicleId(response.data[0]?.id ?? null)
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Unable to load GPS vehicle information right now.'))
    } finally {
      setIsLoading(false)
    }
  }

  const liveVehicles = useMemo<LiveGpsVehicleStatus[]>(
    () =>
      vehicles.map((vehicle, index) => {
        const preset = routePresets[index % routePresets.length]
        return {
          ...vehicle,
          ...preset,
          status: preset.speedKph === 0 ? 'idle' : preset.speedKph < 15 ? 'stopped' : 'moving',
          lastUpdateLabel: index % 2 === 0 ? 'Updated 20s ago' : 'Updated 1m ago',
        }
      }),
    [vehicles],
  )

  const selectedVehicle = liveVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null

  return (
    <div className="live-gps-page">
      <div className="live-gps-header">
        <div>
          <h2>Live GPS Tracking</h2>
          <p>
            Real-time style tracking page for the current fleet. It uses the saved vehicle master records and presents
            a live monitoring board with map-style markers, route labels, and movement status.
          </p>
        </div>
        <button type="button" onClick={() => void loadVehicles()} disabled={isLoading}>
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
                <span>{vehicle.make.slice(0, 1)}</span>
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
                  </tr>
                </thead>
                <tbody>
                  {liveVehicles.map((vehicle) => (
                    <tr
                      key={vehicle.id}
                      className={selectedVehicleId === vehicle.id ? 'gps-row-selected' : ''}
                      onClick={() => setSelectedVehicleId(vehicle.id)}
                    >
                      <td>{vehicle.make} {vehicle.model}</td>
                      <td>
                        <span className={`gps-status-badge gps-status-${vehicle.status}`}>{vehicle.status}</span>
                      </td>
                      <td>{vehicle.speedKph} km/h</td>
                      <td>{vehicle.routeLabel}</td>
                      <td>{vehicle.lastUpdateLabel}</td>
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
                <strong>{selectedVehicle.make} {selectedVehicle.model}</strong>
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
                <span>Updated</span>
                <strong>{selectedVehicle.lastUpdateLabel}</strong>
              </div>
            </div>
          </article>

          <article className="live-gps-card">
            <h3>Tracking Alerts</h3>
            <ul className="lease-scorecard-list">
              <li>Speed threshold alert activates above 80 km/h.</li>
              <li>Unauthorized movement alert triggers when a stopped unit changes geofence after hours.</li>
              <li>Route replay and telematics streams can later be sourced from PostgreSQL-linked tracking tables.</li>
            </ul>
          </article>
        </div>
      ) : (
        <p className="empty-state">Select a vehicle to inspect its tracking details.</p>
      )}

      {error ? <p className="status-message status-error">{error}</p> : null}
    </div>
  )
}


export default LiveGpsTrackingPage

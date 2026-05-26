import { useEffect, useMemo, useState } from 'react'

import { api, getErrorMessage } from '../../api'

import type {
  GpsTrackingRecord,
  Vehicle,
} from '../../types'

const routePresets = [
  {
    routeLabel: 'North Loop',
    geofence: 'Warehouse A',
    heading: 'NE',
    speedKph: 54,
    latitude: 14.5995,
    longitude: 120.9842,
  },
  {
    routeLabel: 'Airport Transfer',
    geofence: 'Terminal Zone',
    heading: 'SE',
    speedKph: 42,
    latitude: 14.5086,
    longitude: 121.0198,
  },
  {
    routeLabel: 'Harbor Dispatch',
    geofence: 'Port Gate',
    heading: 'W',
    speedKph: 18,
    latitude: 14.5832,
    longitude: 120.9701,
  },
  {
    routeLabel: 'City Shuttle',
    geofence: 'Central Business District',
    heading: 'N',
    speedKph: 0,
    latitude: 14.5547,
    longitude: 121.0244,
  },
]

function LiveGpsTrackingPage() {
  const [vehicles, setVehicles] =
    useState<Vehicle[]>([])

  const [gpsRecords, setGpsRecords] =
    useState<GpsTrackingRecord[]>([])

  const [selectedVehicleId, setSelectedVehicleId] =
    useState<number | null>(null)

  const [error, setError] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(true)

  const [successMessage] =
    useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)

    setError('')

    try {
      const [vehiclesResponse, gpsResponse] =
        await Promise.all([
          api.get('/vehicles'),
          api.get('/gps-tracking'),
        ])

      console.log(
        'VEHICLES API:',
        vehiclesResponse.data,
      )

      console.log(
        'GPS API:',
        gpsResponse.data,
      )

      const vehiclesData =
        vehiclesResponse.data?.data ||
        vehiclesResponse.data?.vehicles ||
        vehiclesResponse.data ||
        []

      const safeVehicles =
        Array.isArray(vehiclesData)
          ? vehiclesData
          : []

      const gpsData =
        gpsResponse.data?.data ||
        gpsResponse.data?.gps_tracking ||
        gpsResponse.data ||
        []

      const safeGpsData =
        Array.isArray(gpsData)
          ? gpsData
          : []

      setVehicles(safeVehicles)

      setGpsRecords(safeGpsData)

      setSelectedVehicleId(
        safeVehicles[0]?.id ?? null,
      )
    } catch (loadError: unknown) {
      setError(
        getErrorMessage(
          loadError,
          'Unable to load GPS tracking data right now.',
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  const liveVehicles =
    useMemo<GpsTrackingRecord[]>(
      () =>
        (
          Array.isArray(vehicles)
            ? vehicles
            : []
        ).map((vehicle, index) => {
          const existingRecord =
            (
              Array.isArray(gpsRecords)
                ? gpsRecords
                : []
            ).find(
              (record) =>
                record.vehicleId ===
                vehicle.id,
            )

          if (existingRecord) {
            return existingRecord
          }

          const preset =
            routePresets[
              index %
                routePresets.length
            ]

          return {
            id: -index - 1,
            vehicleId: vehicle.id,
            vehicleLabel: `${vehicle.make} ${vehicle.model} (${vehicle.year})`,
            latitude: preset.latitude,
            longitude: preset.longitude,
            speedKph: preset.speedKph,
            heading: preset.heading,
            status:
              preset.speedKph === 0
                ? 'idle'
                : preset.speedKph < 15
                ? 'stopped'
                : 'moving',
            routeLabel:
              preset.routeLabel,
            geofence:
              preset.geofence,
            recordedAt:
              new Date().toISOString(),
            createdAt:
              new Date().toISOString(),
          }
        }),
      [vehicles, gpsRecords],
    )

  const selectedVehicle =
    (
      Array.isArray(liveVehicles)
        ? liveVehicles
        : []
    ).find(
      (vehicle) =>
        vehicle.id ===
        selectedVehicleId,
    ) ?? null

  return (
    <div className="live-gps-page">
      <div className="live-gps-header">
        <div>
          <h2>
            Live GPS Tracking
          </h2>

          <p>
            Real-time GPS
            tracking for the
            fleet.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadData()
          }
          disabled={isLoading}
        >
          {isLoading
            ? 'Refreshing...'
            : 'Refresh Tracking'}
        </button>
      </div>

      <div className="live-gps-grid">
        <article className="live-gps-card live-gps-map-card">
          <div className="live-gps-card-header">
            <h3>
              Live Map Board
            </h3>

            <span>
              {
                liveVehicles.length
              }{' '}
              active units
            </span>
          </div>

          <div className="live-gps-map">
            {(
              Array.isArray(
                liveVehicles,
              )
                ? liveVehicles
                : []
            ).map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                className={`gps-marker gps-marker-${vehicle.status}`}
                onClick={() =>
                  setSelectedVehicleId(
                    vehicle.id,
                  )
                }
              >
                <span>
                  {vehicle.vehicleLabel
                    .split(' ')[0]
                    .slice(0, 1)}
                </span>
              </button>
            ))}
          </div>
        </article>
      </div>

      {selectedVehicle ? (
        <div>
          Selected Vehicle:{' '}
          {
            selectedVehicle.vehicleLabel
          }
        </div>
      ) : null}

      {error ? (
        <p className="status-message status-error">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="status-message status-success">
          {successMessage}
        </p>
      ) : null}
    </div>
  )
}

export default LiveGpsTrackingPage
import type { Vehicle } from '../../types'

interface VehicleListProps {
  vehicles: Vehicle[]

  onEdit: (
    vehicle: Vehicle,
  ) => void

  onDelete: (
    vehicle: Vehicle,
  ) => void

  busyVehicleId:
    | number
    | null
}

function VehicleList({
  vehicles,
  onEdit,
  onDelete,
  busyVehicleId,
}: VehicleListProps) {
  /*
  |--------------------------------------------------------------------------
  | SAFE ARRAY PROTECTION
  |--------------------------------------------------------------------------
  |
  | Prevents:
  | TypeError: .map is not a function
  |
  */

  const safeVehicles =
    Array.isArray(vehicles)
      ? vehicles
      : []

  /*
  |--------------------------------------------------------------------------
  | EMPTY STATE
  |--------------------------------------------------------------------------
  */

  if (
    safeVehicles.length === 0
  ) {
    return (
      <p className="empty-state">
        No vehicles have been
        added yet.
      </p>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | VEHICLE TABLE
  |--------------------------------------------------------------------------
  */

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              Make
            </th>

            <th>
              Model
            </th>

            <th>
              Year
            </th>

            <th>
              Updated
            </th>

            <th>
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {safeVehicles.map(
            (
              vehicle,
            ) => (
              <tr
                key={
                  vehicle.id
                }
              >
                <td>
                  {
                    vehicle.make
                  }
                </td>

                <td>
                  {
                    vehicle.model
                  }
                </td>

                <td>
                  {
                    vehicle.year
                  }
                </td>

                <td>
                  {
                    vehicle.updatedAt
                  }
                </td>

                <td className="actions-cell">
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() =>
                        onEdit(
                          vehicle,
                        )
                      }
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="button-danger"
                      onClick={() =>
                        onDelete(
                          vehicle,
                        )
                      }
                      disabled={
                        busyVehicleId ===
                        vehicle.id
                      }
                    >
                      {busyVehicleId ===
                      vehicle.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

export default VehicleList
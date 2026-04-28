import type { Vehicle } from '../types'


interface VehicleListProps {
  vehicles: Vehicle[]
  canManage: boolean
  onEdit: (vehicle: Vehicle) => void
  onDelete: (vehicle: Vehicle) => void
  busyVehicleId: number | null
}


function VehicleList({ vehicles, canManage, onEdit, onDelete, busyVehicleId }: VehicleListProps) {
  if (vehicles.length === 0) {
    return <p className="empty-state">No vehicles have been added yet.</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Make</th>
            <th>Model</th>
            <th>Year</th>
            <th>Updated</th>
            {canManage ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id}>
              <td>{vehicle.make}</td>
              <td>{vehicle.model}</td>
              <td>{vehicle.year}</td>
              <td>{vehicle.updatedAt}</td>
              {canManage ? (
                <td className="actions-cell">
                  <button type="button" onClick={() => onEdit(vehicle)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => onDelete(vehicle)}
                    disabled={busyVehicleId === vehicle.id}
                  >
                    {busyVehicleId === vehicle.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default VehicleList

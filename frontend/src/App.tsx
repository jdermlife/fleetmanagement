import { Routes, Route } from 'react-router-dom'
import DriverManagementScorecardPage from './pages/drivers/DriverManagementScorecardPage'
import DriverRegistrationPage from './pages/drivers/DriverRegistrationPage'
import InsuranceManagementPage from './pages/insurance/InsuranceManagementPage'
import LiveGpsTrackingPage from './pages/gps/LiveGpsTrackingPage'
import LendingScorecard from './pages/scoring/LendingScorecard'
import LeaseScorecardPage from './pages/scoring/LeaseScorecardPage'
import MaintenanceManagementPage from './pages/maintenance/MaintenanceManagementPage'
import DashboardSnapshot from './pages/dashboard/DashboardSnapshot'
import AuditTrailPanel from './pages/audit/AuditTrailPanel'
import CreditScoring from './pages/scoring/CreditScoring'
import FuelManagement from './pages/fuel/FuelManagement'
import VehicleDetailPage from './pages/vehicles/VehicleDetailPage'
import VehicleMasterPage from './pages/vehicles/VehicleMasterPage'

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>The Best Car and Fleet Rental</h2>
        <p>Demo Version. Access Rights Integrated in Actual</p>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardSnapshot />} />
          <Route path="/dashboard" element={<DashboardSnapshot />} />
          <Route path="/lending-scorecard" element={<LendingScorecard />} />
          <Route path="/lease-scorecard" element={<LeaseScorecardPage />} />
          <Route path="/vehicle-master" element={<VehicleMasterPage />} />
          <Route path="/vehicle-detail" element={<VehicleDetailPage />} />

          <Route
            path="/driver-management"
            element={<DriverManagementScorecardPage />}
          />

          <Route
            path="/driver-registration"
            element={<DriverRegistrationPage />}
          />

          <Route path="/live-gps" element={<LiveGpsTrackingPage />} />

          <Route
            path="/maintenance-management"
            element={<MaintenanceManagementPage />}
          />

          <Route
            path="/insurance-management"
            element={<InsuranceManagementPage />}
          />

          <Route path="/fuel-management" element={<FuelManagement />} />

          <Route
            path="/credit-scoring"
            element={<CreditScoring />}
          />

          <Route
            path="/audit-trail"
            element={<AuditTrailPanel />}
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
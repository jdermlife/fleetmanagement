import { Routes, Route, Link } from 'react-router-dom'
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

type FleetPage = {
  id: string
  title: string
  description: string
  features: string[]
}

type SidebarLink = {
  id: string
  label: string
}

const sidebarLinkPages: SidebarLink[] = [
  { id: 'dashboard', label: 'Dashboard Snapshot' },
  { id: 'lending-scorecard', label: 'Lending Scorecard' },
  { id: 'lease-scorecard', label: 'Lease Scorecard' },
  { id: 'driver-management', label: 'Driver Management Scorecard' },
  { id: 'driver-registration', label: 'Driver Registration' },
  { id: 'vehicle-master', label: 'Vehicle Master Page' },
  { id: 'vehicle-detail', label: 'Vehicle Detail Page' },
  { id: 'live-gps', label: 'Live GPS Tracking' },
  { id: 'maintenance-management', label: 'Maintenance Management' },

]

const productPages: FleetPage[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Executive overview of fleet operations.',
    features: ['KPI cards'],
  },
  {
    id: 'lending-scorecard',
    title: 'Lending Scorecard',
    description: 'Interactive credit scorecard.',
    features: ['Weighted sections'],
  },
  {
    id: 'lease-scorecard',
    title: 'Lease Scorecard',
    description: 'Lease scoring engine.',
    features: ['Scoring'],
  },
  {
    id: 'vehicle-master',
    title: 'Vehicle Master Page',
    description: 'Central registry of vehicles.',
    features: ['CRUD vehicles'],
  },
  {
    id: 'vehicle-detail',
    title: 'Vehicle Detail Page',
    description: 'Vehicle history and documents.',
    features: ['Maintenance history'],
  },
  {
    id: 'driver-management',
    title: 'Driver Management',
    description: 'Manage drivers and operators.',
    features: ['Driver profiles'],
  },
  {
    id: 'driver-registration',
    title: 'Driver Registration',
    description: 'Register drivers.',
    features: ['Registration'],
  },
  {
    id: 'live-gps',
    title: 'Live GPS Tracking',
    description: 'GPS tracking dashboard.',
    features: ['Maps'],
  },
  {
    id: 'maintenance-management',
    title: 'Maintenance Management',
    description: 'Vehicle maintenance management.',
    features: ['Service schedules'],
  },
  {
    id: 'insurance-management',
    title: 'Insurance Management',
    description: 'Insurance records.',
    features: ['Policies'],
  },
  {
    id: 'fuel-management',
    title: 'Fuel Management',
    description: 'Fuel tracking.',
    features: ['Fuel logs'],
  },
]

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>The Best Car and Fleet Rental</h2>
        <p>Demo Version. Access Rights Integrated in Actual</p>

        <div className="sidebar-link-group">
          {sidebarLinkPages.map((page) => (
            <Link to={`/${page.id}`} key={page.id}>
              {page.label}
            </Link>
          ))}
        </div>

        <nav>
          <ul>
            {productPages.map((page) => (
              <li key={page.id}>
                <Link to={`/${page.id}`}>{page.title}</Link>
              </li>
            ))}

            <li>
              <Link to="/credit-scoring">Credit Scoring</Link>
            </li>
          </ul>
        </nav>
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
          <Route path="/credit-scoring" element={<CreditScoring />} />
          <Route path="/audit-trail" element={<AuditTrailPanel />} />
        </Routes>
      </main>
    </div>
  )
}
export default App
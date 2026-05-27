import { useState } from 'react'
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

type MenuLink = {
  id: string
  label: string
  children?: MenuLink[]
}

const menuLinks: MenuLink[] = [
  { id: 'dashboard', label: 'Dashboard Snapshot' },
  { id: 'lending-scorecard', label: 'Lending Scorecard' },
  { id: 'lease-scorecard', label: 'Lease Scorecard' },
  { id: 'driver-management', label: 'Driver Management' },
  { id: 'driver-registration', label: 'Driver Registration' },
  { id: 'vehicle-master', label: 'Vehicle Master' },
  { id: 'vehicle-detail', label: 'Vehicle Detail' },
  { id: 'live-gps', label: 'Live GPS Tracking' },
  { id: 'maintenance-management', label: 'Maintenance Management' },
  { id: 'insurance-management', label: 'Insurance Management' },
  { id: 'fuel-management', label: 'Fuel Management' },
  { id: 'credit-scoring', label: 'Credit Scoring' },

  {
    id: 'audit-compliance',
    label: 'Audit & Compliance',
    children: [
      {
        id: 'audit-trail',
        label: 'Audit Trail',
      },
      {
        id: 'risk-management',
        label: 'Risk Management',
      },
      {
        id: 'compliance',
        label: 'Compliance',
      },
    ],
  },
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => {
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      {/* TOP NAVIGATION */}
      <header className="sidebar">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
          }}
        >
          {/* BRAND */}
          <div>
            <h2
              style={{
                margin: 0,
                color: '#fff',
              }}
            >
              The Best Car and Fleet Rental
            </h2>

            <p
              style={{
                margin: '4px 0 0',
                fontSize: '0.85rem',
                color: '#fff',
              }}
            >
              Demo Version. Access Rights Integrated in Actual
            </p>
          </div>

          {/* HAMBURGER BUTTON */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              fontSize: '1.4rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            ☰
          </button>
        </div>

        {/* DROPDOWN MENU */}
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '72px',
              right: '24px',
              width: '300px',
              maxHeight: '80vh',
              overflowY: 'auto',
              background: '#b8860b',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
              zIndex: 99999,
            }}
          >
            {menuLinks.map((page) => (
              <div key={page.id}>
                {/* NORMAL MENU ITEM */}
                {!page.children && (
                  <Link
                    to={`/${page.id}`}
                    onClick={closeMenu}
                    style={{
                      display: 'block',
                      color: '#fff',
                      textDecoration: 'none',
                      padding: '12px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      transition: '0.2s',
                      background: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    {page.label}
                  </Link>
                )}

                {/* PARENT MENU WITH CHILDREN */}
                {page.children && (
                  <div>
                    {/* PARENT TITLE */}
                    <div
                      style={{
                        color: '#fff',
                        padding: '12px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        background: 'rgba(255,255,255,0.12)',
                        marginBottom: '8px',
                      }}
                    >
                      {page.label}
                    </div>

                    {/* CHILD LINKS */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        paddingLeft: '12px',
                      }}
                    >
                      {page.children.map((child) => (
                        <Link
                          key={child.id}
                          to={`/${child.id}`}
                          onClick={closeMenu}
                          style={{
                            color: '#fff',
                            textDecoration: 'none',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            fontSize: '0.92rem',
                            background: 'rgba(255,255,255,0.08)',
                          }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </header>

      {/* PAGE CONTENT */}
      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardSnapshot />} />

          <Route
            path="/dashboard"
            element={<DashboardSnapshot />}
          />

          <Route
            path="/lending-scorecard"
            element={<LendingScorecard />}
          />

          <Route
            path="/lease-scorecard"
            element={<LeaseScorecardPage />}
          />

          <Route
            path="/vehicle-master"
            element={<VehicleMasterPage />}
          />

          <Route
            path="/vehicle-detail"
            element={<VehicleDetailPage />}
          />

          <Route
            path="/driver-management"
            element={<DriverManagementScorecardPage />}
          />

          <Route
            path="/driver-registration"
            element={<DriverRegistrationPage />}
          />

          <Route
            path="/live-gps"
            element={<LiveGpsTrackingPage />}
          />

          <Route
            path="/maintenance-management"
            element={<MaintenanceManagementPage />}
          />

          <Route
            path="/insurance-management"
            element={<InsuranceManagementPage />}
          />

          <Route
            path="/fuel-management"
            element={<FuelManagement />}
          />

          <Route
            path="/credit-scoring"
            element={<CreditScoring />}
          />

          <Route
            path="/audit-trail"
            element={<AuditTrailPanel />}
          />

          {/* NEW CHILD PAGES */}
          <Route
            path="/risk-management"
            element={
              <div className="card">
                <h1>Risk Management</h1>
                <p>
                  Risk monitoring and fleet operational risk controls.
                </p>
              </div>
            }
          />

          <Route
            path="/compliance"
            element={
              <div className="card">
                <h1>Compliance</h1>
                <p>
                  Compliance policies, audit reviews, and regulatory tracking.
                </p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
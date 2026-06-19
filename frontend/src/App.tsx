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
import LoanRepository from "./pages/scoring/LoanRepository";
import LoanDetails from "./pages/scoring/LoanDetails";


/* AI PAGES */
import AIDashboard from './pages/ai/AIDashboard'
import ChatAssistant from './pages/ai/ChatAssistant'
import VoiceReports from './pages/ai/VoiceReports'
import OCRScanner from './pages/ai/OCRScanner'
import MaintenanceAI from './pages/ai/MaintenanceAI'
import RiskAnalysis from './pages/ai/RiskAnalysis'
import PDFSummarizer from './pages/ai/PDFSummarizer'
import MeetingMinutes from './pages/ai/MeetingMinutes'
import SendEmail from './pages/ai/SendEmail'
import AttendMeeting from './pages/ai/AttendMeeting'
import ComplianceAI from './pages/ai/ComplianceAI'
import MeetingHistory from './pages/ai/MeetingHistory'
import MeetingDetails from './pages/ai/MeetingDetails'

type MenuLink = {
  id: string
  label: string
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

  /* AI MENU */
  { id: 'ai-dashboard', label: 'AI Dashboard' },
  { id: 'chat-assistant', label: 'Chat Assistant' },
  { id: 'voice-reports', label: 'Voice Reports' },
  { id: 'ocr-scanner', label: 'OCR Scanner' },
  { id: 'maintenance-ai', label: 'Maintenance AI' },
  { id: 'risk-analysis', label: 'Risk Analysis' },
  { id: 'pdf-summarizer', label: 'PDF Summarizer' },
  { id: 'meeting-minutes', label: 'Meeting Minutes' },
  { id: 'send-email', label: 'Send Email' },
  { id: 'attend-meeting', label: 'Attend Meeting' },
  { id: 'compliance-ai', label: 'Compliance AI' },
  { id: 'meeting-history', label: 'Meeting History' },


  /* AUDIT */
  { id: 'audit-trail', label: 'Audit Trail' },
  { id: 'risk-management', label: 'Risk Management' },
  { id: 'compliance', label: 'Compliance' },
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  const [fleetOpen, setFleetOpen] = useState(true)
  const [aiOpen, setAiOpen] = useState(true)
  const [govOpen, setGovOpen] = useState(true)
  const closeMenu = () => {
    setMenuOpen(false)
  }

const aiMenus = [
  'ai-dashboard',
  'chat-assistant',
  'voice-reports',
  'ocr-scanner',
  'maintenance-ai',
  'risk-analysis',
  'pdf-summarizer',
  'meeting-minutes',
  'send-email',
  'attend-meeting',
  'compliance-ai',
  'meeting-history',
]

const governanceMenus = [
  'audit-trail',
  'risk-management',
  'compliance',
]

const fleetMenus = menuLinks.filter(
  (item) =>
    !aiMenus.includes(item.id) &&
    !governanceMenus.includes(item.id)
)

const aiMenuItems = menuLinks.filter(
  (item) => aiMenus.includes(item.id)
)

const govMenuItems = menuLinks.filter(
  (item) => governanceMenus.includes(item.id)
)

  return (
    <div className="app-shell">
      {/* TOP NAVIGATION */}
      <header className="sidebar">
        <div className="app-topbar-row">
          {/* BRAND */}
          <div className="app-brand-block">
            <h2 className="app-brand-title">
              The BestBank Car Financing Company
            </h2>

            <p className="app-brand-subtitle">
              Demo Version. Access Rights Integrated in Actual
            </p>
          </div>

          {/* HAMBURGER BUTTON */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            type="button"
            className="app-menu-toggle"
            aria-label="Toggle application menu"
          >
            ☰
          </button>
        </div>

        {/* DROPDOWN MENU */}
{menuOpen && (
  <div
    className="app-menu-panel"
    style={{
      position: 'absolute',
      top: '72px',
      right: '24px',
      width: '340px',
      maxHeight: '80vh',
      overflowY: 'auto',
      background: '#0f172a',
      borderRadius: '14px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
      zIndex: 99999,
    }}
  >

    {/* FLEET MANAGEMENT */}

    <div
      onClick={() => setFleetOpen(!fleetOpen)}
      className="app-menu-group app-menu-group-fleet"
      style={{
        background: '#1e293b',
        color: '#fff',
        padding: '12px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
      }}
    >
      📊 FLEET MANAGEMENT {fleetOpen ? '▲' : '▼'}
    </div>

    {fleetOpen &&
      fleetMenus.map((page) => (
        <Link
          key={page.id}
          to={`/${page.id}`}
          onClick={closeMenu}
          className="app-menu-link app-menu-link-fleet"
          style={{
            display: 'block',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          {page.label}
        </Link>
      ))}

    {/* AI TOOLS */}

    <div
      onClick={() => setAiOpen(!aiOpen)}
      className="app-menu-group app-menu-group-ai"
      style={{
        background: '#083344',
        color: '#67e8f9',
        padding: '12px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        marginTop: '10px',
      }}
    >
      🤖 AI TOOLS {aiOpen ? '▲' : '▼'}
    </div>

    {aiOpen &&
      aiMenuItems.map((page) => (
        <Link
          key={page.id}
          to={`/${page.id}`}
          onClick={closeMenu}
          className="app-menu-link app-menu-link-ai"
          style={{
            display: 'block',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background:
              'linear-gradient(135deg,#0f766e,#0891b2)',
          }}
        >
          🤖 {page.label}
        </Link>
      ))}

    {/* GOVERNANCE */}

    <div
      onClick={() => setGovOpen(!govOpen)}
      className="app-menu-group app-menu-group-governance"
      style={{
        background: '#7c2d12',
        color: '#fed7aa',
        padding: '12px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        marginTop: '10px',
      }}
    >
      🛡 GOVERNANCE & COMPLIANCE {govOpen ? '▲' : '▼'}
    </div>

    {govOpen &&
      govMenuItems.map((page) => (
        <Link
          key={page.id}
          to={`/${page.id}`}
          onClick={closeMenu}
          className="app-menu-link app-menu-link-governance"
          style={{
            display: 'block',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background:
              'linear-gradient(135deg,#92400e,#b45309)',
          }}
        >
          🛡 {page.label}
        </Link>
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
            path="/loan-repository"
            element={<LoanRepository />}
          />
          <Route
            path="/loan-applications"
            element={<LoanRepository />}
          />
          <Route
            path="/loan-details/:applicationNo"
            element={<LoanDetails />}
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

          {/* RISK MANAGEMENT */}
          <Route
            path="/risk-management"
            element={
              <div className="card">
                <h1>Risk Management</h1>

                <p>
                  Risk monitoring, operational controls,
                  fraud prevention, and fleet governance.
                </p>
              </div>
            }
          />

          {/* COMPLIANCE */}
          <Route
            path="/compliance"
            element={
              <div className="card">
                <h1>Compliance</h1>

                <p>
                  Regulatory compliance, internal controls,
                  audit reviews, and compliance reporting.
                </p>
              </div>
            }
          />

          {/* AI ROUTES */}
          <Route
            path="/ai-dashboard"
            element={<AIDashboard />}
          />

          <Route
            path="/chat-assistant"
            element={<ChatAssistant />}
          />

          <Route
            path="/voice-reports"
            element={<VoiceReports />}
          />

          <Route
            path="/ocr-scanner"
            element={<OCRScanner />}
          />

          <Route
            path="/maintenance-ai"
            element={<MaintenanceAI />}
          />

          <Route
            path="/risk-analysis"
            element={<RiskAnalysis />}
          />

          <Route
            path="/pdf-summarizer"
            element={<PDFSummarizer />}
          />

          <Route
            path="/meeting-minutes"
            element={<MeetingMinutes />}
          />

          <Route
            path="/send-email"
            element={<SendEmail />}
          />

          <Route
            path="/attend-meeting"
            element={<AttendMeeting />}
          />

          <Route
            path="/compliance-ai"
            element={<ComplianceAI />}
          />
          <Route
             path="/ai/history"
             element={<MeetingHistory />}
          />

          <Route
            path="/ai/history/:id"
            element={<MeetingDetails />}
          />

          <Route
            path="/meeting-history"
            element={<MeetingHistory />}
          />
        
       
        </Routes>
      </main>
    </div>
  )
}

export default App

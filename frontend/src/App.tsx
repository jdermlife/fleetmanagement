import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'

import { fetchCurrentUser, getAuthToken, logout, type LoginResponse } from './api'
import ProtectedRoute from './components/auth/ProtectedRoute'

type MenuLink = {
  id: string
  label: string
}

const DashboardSnapshot = lazy(() => import('./pages/dashboard/DashboardSnapshot'))
const LendingScorecard = lazy(() => import('./pages/scoring/LendingScorecard'))
const LeaseScorecardPage = lazy(() => import('./pages/scoring/LeaseScorecardPage'))
const InsuranceManagementPage = lazy(() => import('./pages/insurance/InsuranceManagementPage'))
const CreditScoring = lazy(() => import('./pages/scoring/CreditScoring'))
const AuditTrailPanel = lazy(() => import('./pages/audit/AuditTrailPanel'))
const FuelManagement = lazy(() => import('./pages/fuel/FuelManagement'))
const VehicleDetailPage = lazy(() => import('./pages/vehicles/VehicleDetailPage'))
const VehicleMasterPage = lazy(() => import('./pages/vehicles/VehicleMasterPage'))
const LoanRepository = lazy(() => import('./pages/scoring/LoanRepository'))
const LoanDetails = lazy(() => import('./pages/scoring/LoanDetails'))
const ApprovalQueue = lazy(() => import('./pages/scoring/ApprovalQueue'))
const CreditReviewWorkbench = lazy(() => import('./pages/scoring/CreditReviewWorkbench'))
const ReleasedAccounts = lazy(() => import('./pages/scoring/ReleasedAccounts'))
const LegacyLoanDashboard = lazy(() => import('./pages/dashboard/LoanDashboard'))
const LegacyBorrowerProfile = lazy(() => import('./pages/scoring/BorrowerProfile'))
const LegacyCreditCommitteeReview = lazy(() => import('./pages/scoring/CreditCommitteeReview'))
const LegacyScoringAuditTrailPanel = lazy(() => import('./pages/scoring/AuditTrailPanel'))
const DriverManagementScorecardPage = lazy(() => import('./pages/drivers/DriverManagementScorecardPage'))
const DriverRegistrationPage = lazy(() => import('./pages/drivers/DriverRegistrationPage'))
const LiveGpsTrackingPage = lazy(() => import('./pages/gps/LiveGpsTrackingPage'))
const MaintenanceManagementPage = lazy(() => import('./pages/maintenance/MaintenanceManagementPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const AccountSettingsPage = lazy(() => import('./pages/auth/AccountSettingsPage'))
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/legal/TermsPage'))
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'))
const RoleManagementPage = lazy(() => import('./pages/admin/RoleManagementPage'))
const PermissionManagementPage = lazy(() => import('./pages/admin/PermissionManagementPage'))
const SubscriptionManagementPage = lazy(() => import('./pages/subscriptions/SubscriptionManagementPage'))
const SubscriptionPaymentPage = lazy(() => import('./pages/subscriptions/SubscriptionPaymentPage'))

const AIDashboard = lazy(() => import('./pages/ai/AIDashboard'))
const ChatAssistant = lazy(() => import('./pages/ai/ChatAssistant'))
const VoiceReports = lazy(() => import('./pages/ai/VoiceReports'))
const OCRScanner = lazy(() => import('./pages/ai/OCRScanner'))
const MaintenanceAI = lazy(() => import('./pages/ai/MaintenanceAI'))
const RiskAnalysis = lazy(() => import('./pages/ai/RiskAnalysis'))
const PDFSummarizer = lazy(() => import('./pages/ai/PDFSummarizer'))
const MeetingMinutes = lazy(() => import('./pages/ai/MeetingMinutes'))
const SendEmail = lazy(() => import('./pages/ai/SendEmail'))
const AttendMeeting = lazy(() => import('./pages/ai/AttendMeeting'))
const ComplianceAI = lazy(() => import('./pages/ai/ComplianceAI'))
const MeetingHistory = lazy(() => import('./pages/ai/MeetingHistory'))
const MeetingDetails = lazy(() => import('./pages/ai/MeetingDetails'))


const menuLinks: MenuLink[] = [
  { id: 'dashboard', label: 'Dashboard Snapshot' },
  { id: 'lending-scorecard', label: 'Lending Scorecard' },
  { id: 'lease-scorecard', label: 'Lease Scorecard' },
  { id: 'insurance-management', label: 'Insurance Management' },
  { id: 'credit-scoring', label: 'Collateral Management' },
  { id: 'subscriptions', label: 'Subscription Billing' },

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

  /* ADMIN */
  { id: 'admin-users', label: 'User Management' },
  { id: 'admin-roles', label: 'Admin Role Management' },
  { id: 'admin-permissions', label: 'Permission Management' },
]

const AUTH_PATH_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password']
const LAST_ROUTE_STORAGE_KEY = 'fms:last-route'

function isAuthPath(pathname: string) {
  return AUTH_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}?`))
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authDropdownOpen, setAuthDropdownOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<LoginResponse['user'] | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [fleetOpen, setFleetOpen] = useState(true)
  const [aiOpen, setAiOpen] = useState(true)
  const [govOpen, setGovOpen] = useState(true)
  const closeMenu = () => {
    setMenuOpen(false)
  }

  const closeAuthDropdown = () => {
    setAuthDropdownOpen(false)
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

const adminMenus = [
  'admin-users',
  'admin-roles',
  'admin-permissions',
]

const subscriberHiddenMenus = [
  'insurance-management',
  'credit-scoring',
  'subscriptions',
  'admin-users',
  'admin-roles',
  'admin-permissions',
]

const subscriberAlwaysVisibleMenus = [
  'lending-scorecard',
  'lease-scorecard',
]

const isSubscriber = currentUser?.role?.toLowerCase() === 'subscriber'

const visibleMenuLinks = isSubscriber
  ? menuLinks.filter(
      (item) =>
        subscriberAlwaysVisibleMenus.includes(item.id) ||
        !subscriberHiddenMenus.includes(item.id),
    )
  : menuLinks

const fleetMenus = visibleMenuLinks.filter(
  (item) =>
    !aiMenus.includes(item.id) &&
    !governanceMenus.includes(item.id) &&
    !adminMenus.includes(item.id)
)

const aiMenuItems = visibleMenuLinks.filter(
  (item) => aiMenus.includes(item.id)
)

const govMenuItems = visibleMenuLinks.filter(
  (item) => governanceMenus.includes(item.id)
)

const adminMenuItems = visibleMenuLinks.filter(
  (item) => adminMenus.includes(item.id),
)

  useEffect(() => {
    const token = getAuthToken()

    if (!token) {
      setCurrentUser(null)
      setAuthReady(true)
      return
    }

    const loadCurrentUser = async () => {
      try {
        const user = await fetchCurrentUser()
        setCurrentUser(user)
      } catch {
        setCurrentUser(null)
      } finally {
        setAuthReady(true)
      }
    }

    void loadCurrentUser()
  }, [location.pathname])

  useEffect(() => {
    if (isAuthPath(location.pathname)) {
      return
    }

    window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, location.pathname)
  }, [location.pathname])

  useEffect(() => {
    setAuthDropdownOpen(false)
  }, [location.pathname])

  const handleTopbarLogout = async () => {
    await logout()
    setCurrentUser(null)
    navigate('/login')
  }

  return (
    <div className="app-shell">
      {/* TOP NAVIGATION */}
      <header className="sidebar">
        <div className="app-topbar-row">
          {/* BRAND */}
          <div className="app-brand-block">
            <h2 className="app-brand-title">
              LENDWISE
            </h2>

            <p className="app-brand-subtitle">
             Everyone's Lending Tool
            </p>
          </div>

          <div className="app-auth-summary">
            <button
              type="button"
              className="app-auth-action"
              onClick={() => setAuthDropdownOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={authDropdownOpen}
            >
              {authReady && currentUser ? currentUser.username : 'Account'}
            </button>

            {authDropdownOpen && (
              <div className="app-auth-dropdown" role="menu">
                {authReady && currentUser ? (
                  <>
                    <div className="app-auth-chip">
                      <span className="app-auth-chip-label">Signed In</span>
                      <strong>{currentUser.username}</strong>
                    </div>
                    <Link className="app-auth-link" to="/account" onClick={closeAuthDropdown}>
                      Account
                    </Link>
                    <button
                      type="button"
                      className="app-auth-action"
                      onClick={() => {
                        closeAuthDropdown()
                        void handleTopbarLogout()
                      }}
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link className="app-auth-link" to="/login" onClick={closeAuthDropdown}>
                      Sign In
                    </Link>
                    <Link className="app-auth-link" to="/register" onClick={closeAuthDropdown}>
                      Register
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* HAMBURGER BUTTON */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            type="button"
            className="app-menu-toggle"
            aria-label="Toggle application menu"
            aria-expanded={menuOpen}
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

    {/* OPERATIONS */}

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
      OPERATIONS {fleetOpen ? '▲' : '▼'}
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

    {adminMenuItems.length > 0 && (
      <>
        <div
          className="app-menu-group app-menu-group-account"
          style={{
            background: '#3f1d5c',
            color: '#f5e8ff',
            padding: '12px',
            borderRadius: '8px',
            fontWeight: 'bold',
            marginTop: '10px',
          }}
        >
          ADMINISTRATION
        </div>
        {adminMenuItems.map((page) => (
          <Link
            key={page.id}
            to={`/${page.id}`}
            onClick={closeMenu}
            className="app-menu-link app-menu-link-account"
            style={{
              display: 'block',
              color: '#fff',
              textDecoration: 'none',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(120, 76, 153, 0.35)',
            }}
          >
            {page.label}
          </Link>
        ))}
      </>
    )}

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

    <div
      className="app-menu-group app-menu-group-account"
      style={{
        background: '#1f2937',
        color: '#e2e8f0',
        padding: '12px',
        borderRadius: '8px',
        fontWeight: 'bold',
        marginTop: '10px',
      }}
    >
      ACCOUNT & LEGAL
    </div>

    {currentUser ? (
      <>
        <Link
          to="/account"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          Account Settings
        </Link>
        <button
          type="button"
          onClick={() => {
            closeMenu()
            void handleTopbarLogout()
          }}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            textAlign: 'left',
          }}
        >
          Sign Out
        </button>
      </>
    ) : (
      <>
        <Link
          to="/login"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          Sign In
        </Link>
        <Link
          to="/register"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          Create Account
        </Link>
      </>
    )}
    <Link
      to="/privacy"
      onClick={closeMenu}
      className="app-menu-link app-menu-link-account"
      style={{
        display: 'block',
        color: '#fff',
        textDecoration: 'none',
        padding: '12px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.05)',
      }}
    >
      Privacy Disclosures
    </Link>
    <Link
      to="/terms"
      onClick={closeMenu}
      className="app-menu-link app-menu-link-account"
      style={{
        display: 'block',
        color: '#fff',
        textDecoration: 'none',
        padding: '12px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.05)',
      }}
    >
      Terms & Consent
    </Link>
  </div>
  
)}

</header>
  {/* PAGE CONTENT */}
      <main className="content">
        <Suspense fallback={<div className="card">Loading page...</div>}>
          <Routes>
            <Route path="/" element={<DashboardSnapshot />} />

            <Route
              path="/dashboard"
              element={<DashboardSnapshot />}
            />

            <Route
              path="/lending-scorecard"
              element={
                <ProtectedRoute roles={['admin', 'subscriber']}>
                  <LendingScorecard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/loan-repository"
              element={
                <ProtectedRoute permissions={['read:loans']}>
                  <LoanRepository />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loan-applications"
              element={
                <ProtectedRoute permissions={['read:loans']}>
                  <LoanRepository />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loan-details/:applicationNo"
              element={
                <ProtectedRoute permissions={['read:loans']}>
                  <LoanDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="/approval-queue"
              element={
                <ProtectedRoute permissions={['approve:loans']}>
                  <ApprovalQueue />
                </ProtectedRoute>
              }
            />

            <Route
              path="/credit-review-workbench"
              element={
                <ProtectedRoute permissions={['read:loans', 'edit:loans', 'approve:loans']}>
                  <CreditReviewWorkbench />
                </ProtectedRoute>
              }
            />

            <Route
              path="/released-accounts"
              element={
                <ProtectedRoute permissions={['final_approve:loans', 'read:loans']}>
                  <ReleasedAccounts />
                </ProtectedRoute>
              }
            />

            <Route
              path="/loan-dashboard"
              element={<LegacyLoanDashboard />}
            />

            <Route
              path="/borrower-profile"
              element={<LegacyBorrowerProfile />}
            />

            <Route
              path="/credit-committee-review"
              element={<LegacyCreditCommitteeReview />}
            />

            <Route
              path="/scoring-audit-trail-panel"
              element={<LegacyScoringAuditTrailPanel />}
            />

            <Route
              path="/scoring/audit-trail-panel"
              element={<LegacyScoringAuditTrailPanel />}
            />

            <Route
              path="/lease-scorecard"
              element={
                <ProtectedRoute roles={['admin', 'subscriber']}>
                  <LeaseScorecardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/vehicle-master"
              element={
                <ProtectedRoute permissions={['read:vehicles', 'write:vehicles']}>
                  <VehicleMasterPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/vehicle-detail"
              element={
                <ProtectedRoute permissions={['read:vehicles']}>
                  <VehicleDetailPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/driver-management"
              element={
                <ProtectedRoute permissions={['read:drivers', 'write:drivers']}>
                  <DriverManagementScorecardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/driver-registration"
              element={
                <ProtectedRoute permissions={['write:drivers']}>
                  <DriverRegistrationPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/live-gps"
              element={
                <ProtectedRoute permissions={['read:vehicles']}>
                  <LiveGpsTrackingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/maintenance-management"
              element={
                <ProtectedRoute permissions={['read:vehicles']}>
                  <MaintenanceManagementPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/insurance-management"
              element={
                <ProtectedRoute roles={['admin']} permissions={['read:vehicles']}>
                  <InsuranceManagementPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/fuel-management"
              element={
                <ProtectedRoute permissions={['read:fuel_logs', 'write:fuel_logs']}>
                  <FuelManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/credit-scoring"
              element={
                <ProtectedRoute roles={['admin']} permissions={['read:scorecards', 'read:analytics']}>
                  <CreditScoring />
                </ProtectedRoute>
              }
            />

            <Route
              path="/subscriptions"
              element={
                <ProtectedRoute roles={['admin']}>
                  <SubscriptionManagementPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/subscription-payment"
              element={
                <ProtectedRoute roles={['admin', 'subscriber']}>
                  <SubscriptionPaymentPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/audit-trail"
              element={
                <ProtectedRoute permissions={['read:audit_logs']}>
                  <AuditTrailPanel />
                </ProtectedRoute>
              }
            />

            {/* RISK MANAGEMENT */}
            <Route
              path="/risk-management"
              element={
                <ProtectedRoute permissions={['read:audit_logs', 'read:analytics']}>
                  <div className="card">
                    <h1>Risk Management</h1>

                    <p>
                      Risk monitoring, operational controls,
                      fraud prevention, and fleet governance.
                    </p>
                  </div>
                </ProtectedRoute>
              }
            />

            {/* COMPLIANCE */}
            <Route
              path="/compliance"
              element={
                <ProtectedRoute permissions={['read:audit_logs']}>
                  <div className="card">
                    <h1>Compliance</h1>

                    <p>
                      Regulatory compliance, internal controls,
                      audit reviews, and compliance reporting.
                    </p>
                  </div>
                </ProtectedRoute>
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

            <Route
              path="/login"
              element={<LoginPage />}
            />

            <Route
              path="/register"
              element={<RegisterPage />}
            />

            <Route
              path="/forgot-password"
              element={<ForgotPasswordPage />}
            />

            <Route
              path="/reset-password"
              element={<ResetPasswordPage />}
            />

            <Route
              path="/account"
              element={<AccountSettingsPage />}
            />

            <Route
              path="/settings"
              element={<AccountSettingsPage />}
            />

            <Route
              path="/privacy"
              element={<PrivacyPage />}
            />

            <Route
              path="/terms"
              element={<TermsPage />}
            />

            <Route
              path="/admin-users"
              element={
                <ProtectedRoute roles={['admin']} permissions={['admin:users', 'manage:system']}>
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin-roles"
              element={
                <ProtectedRoute roles={['admin']} permissions={['manage:system']}>
                  <RoleManagementPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin-permissions"
              element={
                <ProtectedRoute roles={['admin']} permissions={['manage:system']}>
                  <PermissionManagementPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App

import { Suspense, lazy, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { fetchCurrentUser, getAuthToken, logout, type LoginResponse } from './api'
import {
  SUBSCRIBER_BORROWER_ROLE,
  SUBSCRIBER_LENDER_ROLE,
  SUBSCRIBER_ROLE,
  isBorrowerSubscriberRole,
  isLenderSubscriberRole,
} from './authRoles'
import { APP_NAME, APP_TAGLINE, brandLogoDataUri } from './brand'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AutosaveStatus from './components/AutosaveStatus'
import { prepareAutosavesForLogout } from './autosave/useAutosaveDraft'

type MenuLink = {
  id: string
  label: string
}

function lazyWithRetry<T extends { default: ComponentType<unknown> }>(
  importer: () => Promise<T>,
) {
  return lazy(async () => {
    try {
      return await importer()
    } catch (error) {
      // Refresh once to recover from stale chunk references after deployment.
      if (typeof window !== 'undefined' && !sessionStorage.getItem('lazy-retry')) {
        sessionStorage.setItem('lazy-retry', '1')
        window.location.reload()
      }
      throw error
    }
  })
}


const FinancialHealthSummaryPage = lazyWithRetry(() => import('./pages/scoring/FinancialHealthSummaryPage'))
const LendingScorecard = lazyWithRetry(() => import('./pages/scoring/LendingScorecard'))
const LeaseScorecardPage = lazy(() => import('./pages/scoring/LeaseScorecardPage'))
const InsuranceManagementPage = lazy(() => import('./pages/insurance/InsuranceManagementPage'))
const CreditScoring = lazy(() => import('./pages/scoring/CreditScoring'))
const BudgetExpenseTrackerPage = lazy(() => import('./pages/scoring/BudgetExpenseTrackerPage'))
const LoanMonitoringPage = lazy(() => import('./pages/scoring/LoanMonitoringPage'))
const BillReminderPage = lazy(() => import('./pages/scoring/BillReminderPage'))
const DashboardSnapshot = lazyWithRetry(() => import('./pages/dashboard/DashboardSnapshot'))
const Snapshot = lazyWithRetry(() => import('./pages/dashboard/Snapshot'))
const CollateralMonitoringPage = lazy(() => import('./pages/scoring/CollateralMonitoringPage'))
const NetWorthPositioningPage = lazy(() => import('./pages/scoring/NetWorthPositioningPage'))
const AuditTrailPanel = lazy(() => import('./pages/audit/AuditTrailPanel'))
const FuelManagement = lazy(() => import('./pages/fuel/FuelManagement'))
const VehicleDetailPage = lazy(() => import('./pages/vehicles/VehicleDetailPage'))
const VehicleMasterPage = lazy(() => import('./pages/vehicles/VehicleMasterPage'))
const LoanRepository = lazy(() => import('./pages/scoring/LoanRepository'))
const LoanDetails = lazy(() => import('./pages/scoring/LoanDetails'))
const LoanCertificationPage = lazy(() => import('./pages/scoring/LoanCertificationPage'))
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
const AboutFilscorePage = lazy(() => import('./pages/legal/AboutFilscorePage'))
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/legal/TermsPage'))
const SupportPage = lazy(() => import('./pages/legal/SupportPage'))
const SubscriptionFeesPage = lazy(() => import('./pages/legal/SubscriptionFeesPage'))
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'))
const RoleManagementPage = lazy(() => import('./pages/admin/RoleManagementPage'))
const PermissionManagementPage = lazy(() => import('./pages/admin/PermissionManagementPage'))
const SubscriptionManagementPage = lazyWithRetry(() => import('./pages/subscriptions/SubscriptionManagementPage'))
const SubscriptionPaymentPage = lazyWithRetry(() => import('./pages/subscriptions/SubscriptionPaymentPage'))
const TrialExpiredReminderPage = lazy(() => import('./pages/subscriptions/TrialExpiredReminderPage'))
const BillingPage = lazyWithRetry(() => import('./pages/subscriptions/BillingPage'))
const RiskManagementPage = lazy(() => import('./pages/governance/RiskManagementPage'))
const CompliancePage = lazy(() => import('./pages/governance/CompliancePage'))

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
  
  { id: 'financial-health-summary', label: 'Financial Health Dashboard' },
  { id: 'lending-scorecard', label: 'Credit Health Score' },
  { id: 'net-worth-positioning', label: 'Wealth Building Score' },
  { id: 'budget-expense-tracker', label: 'Budget Tracker' },
  { id: 'loan-monitoring', label: 'Debt Optimizer' },
  { id: 'bill-reminder', label: 'Bill Manager' },
  { id: 'dashboard', label: 'Multiple Accounts Snapshot' },

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
  { id: 'trial-expired', label: 'Trial Expired Reminder' },
]

const AUTH_PATH_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password']
const LAST_ROUTE_STORAGE_KEY = 'fms:last-route'
const THEME_STORAGE_KEY = 'fms:theme'
const LEGACY_UNSCOPED_DRAFT_KEYS = [
  'fms:bill-reminder-setup',
  'fms:networth-balance-sheet',
]
const VALID_THEME_IDS = new Set(['classic', 'civic', 'philippine-flag'])

function isAuthPath(pathname: string) {
  return AUTH_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}?`))
}

function authenticatedPage(
  children: ReactNode,
  roles: string[] = ['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE],
) {
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<LoginResponse['user'] | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [fleetOpen, setFleetOpen] = useState(true)
  const [aiOpen, setAiOpen] = useState(true)
  const [govOpen, setGovOpen] = useState(true)

  const closeMenu = () => {
    setMenuOpen(false)
  }

  const handleTopbarBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    if (currentUser) {
      navigate(defaultHomePath)
      return
    }

    navigate('/login')
  }

  const handleTopbarForward = () => {
    navigate(1)
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
  'trial-expired',
]

const subscriberHiddenMenus = [
  'snapshot',
  'lease-scorecard',
  'insurance-management',
  'credit-scoring',
  'ai-dashboard',
  'ocr-scanner',
  'voice-reports',
  'audit-trail',
  'risk-management',
  'compliance',
  'subscriptions',
  'admin-users',
  'admin-roles',
  'admin-permissions',
  'trial-expired',
]

const subscriberAlwaysVisibleMenus = [
  'financial-health-summary',
  'lending-scorecard',
  'budget-expense-tracker',
  'loan-monitoring',
  'bill-reminder',
  'collateral-monitoring',
  'net-worth-positioning',
]

const borrowerVisibleMenus = [
  'financial-health-summary',
  'lending-scorecard',
  'budget-expense-tracker',
  'loan-monitoring',
  'bill-reminder',
  'collateral-monitoring',
  'net-worth-positioning',
]

const isBorrowerSubscriber = isBorrowerSubscriberRole(currentUser?.role)
const isLenderSubscriber = isLenderSubscriberRole(currentUser?.role)
const isAdminUser = currentUser?.role?.toLowerCase() === 'admin'
const defaultHomePath = '/financial-health-summary'

const visibleMenuLinks = isBorrowerSubscriber
  ? menuLinks.filter((item) => borrowerVisibleMenus.includes(item.id))
  : isLenderSubscriber
    ? menuLinks.filter(
        (item) =>
          subscriberAlwaysVisibleMenus.includes(item.id) ||
          !subscriberHiddenMenus.includes(item.id),
      )
    : menuLinks.filter(
      (item) => isAdminUser || (!adminMenus.includes(item.id) && !governanceMenus.includes(item.id)),
    )

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

const adminMenuItems = isAdminUser
  ? visibleMenuLinks.filter((item) => adminMenus.includes(item.id))
  : []

const isLoginRoute = location.pathname === '/login'
const shouldShowBackButton = !['/', '/dashboard', '/lending-scorecard', '/financial-health-summary', '/login'].includes(location.pathname)
const isSignedIn = authReady && Boolean(currentUser)

  useEffect(() => {
    const token = getAuthToken()

    if (!token) {
      setCurrentUser(null)
      setAuthReady(true)
      return
    }

    if (currentUser) {
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
  }, [currentUser, location.pathname])

  useEffect(() => {
    if (isAuthPath(location.pathname)) {
      return
    }

    window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, location.pathname)
  }, [location.pathname])

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    document.documentElement.dataset.theme =
      savedTheme && VALID_THEME_IDS.has(savedTheme) ? savedTheme : 'classic'
  }, [])

  useEffect(() => {
    LEGACY_UNSCOPED_DRAFT_KEYS.forEach((key) => window.localStorage.removeItem(key))
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setMenuOpen(false)
    }
  }, [currentUser])

  const handleTopbarLogout = async () => {
    await prepareAutosavesForLogout()
    await logout()
    setCurrentUser(null)
    navigate('/login')
  }

  useEffect(() => {
    const handleSessionExpired = () => {
      setCurrentUser(null)
      navigate('/login')
    }
    window.addEventListener('auth:session-expired', handleSessionExpired)
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired)
  }, [navigate])

  return (
    <div className="app-shell">
      {/* TOP NAVIGATION */}
      {!isLoginRoute ? (
      <header className="sidebar">
        <div className="app-topbar-row">
          {/* BRAND */}
          <div className="app-brand-block">
            <div className="app-brand-lockup">
              <img className="app-brand-mark" src={brandLogoDataUri} alt={`${APP_NAME} logo`} />
              <div className="app-brand-text">
                <h2 className="app-brand-title">{APP_NAME}</h2>
                <p className="app-brand-subtitle">{APP_TAGLINE}</p>
              </div>
            </div>
          </div>

          <div className="app-topbar-actions">
            {isSignedIn ? <AutosaveStatus className="app-autosave-status" /> : null}
            {(isSignedIn || shouldShowBackButton) ? (
              <div className="app-topbar-control-group">
                {isSignedIn ? (
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    type="button"
                    className="app-menu-toggle"
                    aria-label="Toggle account and application menu"
                    aria-expanded={menuOpen}
                  >
                    {`${currentUser?.username ?? 'Account'} • Menu`}
                  </button>
                ) : null}

                {shouldShowBackButton ? (
                  <div className="app-mini-nav" aria-label="Page navigation controls">
                    <button
                      type="button"
                      className="app-mini-nav-button"
                      onClick={handleTopbarBack}
                      aria-label="Go back"
                      title="Back"
                    >
                      &larr;
                    </button>
                    <button
                      type="button"
                      className="app-mini-nav-button"
                      onClick={handleTopbarForward}
                      aria-label="Go forward"
                      title="Next"
                    >
                      &rarr;
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* DROPDOWN MENU */}
    {isSignedIn && menuOpen && (
  <div
    className="app-menu-panel"
    style={{
      background: 'var(--app-menu-panel-bg)',
    }}
  >
    {/* TOOLS */}

    <div
      onClick={() => setFleetOpen(!fleetOpen)}
      className="app-menu-group app-menu-group-fleet"
      style={{
        background: 'var(--app-menu-group-fleet-bg)',
        color: 'var(--app-menu-group-fleet-text)',
        padding: '12px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
      }}
    >
      TOOLS {fleetOpen ? '▲' : '▼'}
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
            color: 'var(--app-menu-link-text)',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--app-menu-link-bg)',
          }}
        >
          {page.label}
        </Link>
      ))}

    {false && !isBorrowerSubscriber && !isLenderSubscriber && (
      <>
        {/* AI TOOLS */}

        <div
          onClick={() => setAiOpen(!aiOpen)}
          className="app-menu-group app-menu-group-ai"
          style={{
            background: 'var(--app-menu-group-ai-bg)',
            color: 'var(--app-menu-group-ai-text)',
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
                color: 'var(--app-menu-link-text)',
                textDecoration: 'none',
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--app-menu-link-ai-bg)',
              }}
            >
              🤖 {page.label}
            </Link>
          ))}
      </>
    )}

    {isAdminUser && adminMenuItems.length > 0 && (
      <>
        <div
          className="app-menu-group app-menu-group-account"
          style={{
            background: 'var(--app-menu-group-admin-bg)',
            color: 'var(--app-menu-group-admin-text)',
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
              color: 'var(--app-menu-link-text)',
              textDecoration: 'none',
              padding: '12px',
              borderRadius: '8px',
              background: 'var(--app-menu-link-admin-bg)',
            }}
          >
            {page.label}
          </Link>
        ))}
      </>
    )}

    {isAdminUser && govMenuItems.length > 0 && (
      <>
        {/* GOVERNANCE */}

        <div
          onClick={() => setGovOpen(!govOpen)}
          className="app-menu-group app-menu-group-governance"
          style={{
            background: 'var(--app-menu-group-governance-bg)',
            color: 'var(--app-menu-group-governance-text)',
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
                color: 'var(--app-menu-link-text)',
                textDecoration: 'none',
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--app-menu-link-governance-bg)',
              }}
            >
              🛡 {page.label}
            </Link>
          ))}
      </>
    )}

    <div
      className="app-menu-group app-menu-group-account"
      style={{
        background: 'var(--app-menu-group-account-bg)',
        color: 'var(--app-menu-group-account-text)',
        padding: '12px',
        borderRadius: '8px',
        fontWeight: 'bold',
        marginTop: '10px',
      }}
    >
      PROFILE
    </div>

    {currentUser ? (
      <>
        <Link
          to="/account"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: 'var(--app-menu-link-text)',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--app-menu-link-bg)',
          }}
        >
          Account Settings
        </Link>
      </>
    ) : (
      <>
        <Link
          to="/login"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: 'var(--app-menu-link-text)',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--app-menu-link-bg)',
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
            color: 'var(--app-menu-link-text)',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--app-menu-link-bg)',
          }}
        >
          Create Account
        </Link>
      </>
    )}
    {isAdminUser ? (
      <>
        <Link
          to="/billing"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: 'var(--app-menu-link-text)',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--app-menu-link-bg)',
          }}
        >
          Billing
        </Link>
        <Link
          to="/subscriptions"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: 'var(--app-menu-link-text)',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--app-menu-link-bg)',
          }}
        >
          Subscription
        </Link>
        <Link
          to="/invoices"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: 'var(--app-menu-link-text)',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--app-menu-link-bg)',
          }}
        >
          Invoices
        </Link>
        <Link
          to="/payment-history"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: 'var(--app-menu-link-text)',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--app-menu-link-bg)',
          }}
        >
          Payment History
        </Link>
        <Link
          to="/subscriptions"
          onClick={closeMenu}
          className="app-menu-link app-menu-link-account"
          style={{
            display: 'block',
            color: 'var(--app-menu-link-text)',
            textDecoration: 'none',
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--app-menu-link-bg)',
          }}
        >
          Subscription Billing
        </Link>
      </>
    ) : null}
    {isAdminUser ? (
      <Link
        to="/subscription-fees"
        onClick={closeMenu}
        className="app-menu-link app-menu-link-account"
        style={{
          display: 'block',
          color: 'var(--app-menu-link-text)',
          textDecoration: 'none',
          padding: '12px',
          borderRadius: '8px',
          background: 'var(--app-menu-link-bg)',
        }}
      >
        Subscription Fees
      </Link>
    ) : null}
    <Link
      to="/support"
      onClick={closeMenu}
      className="app-menu-link app-menu-link-account"
      style={{
        display: 'block',
        color: 'var(--app-menu-link-text)',
        textDecoration: 'none',
        padding: '12px',
        borderRadius: '8px',
        background: 'var(--app-menu-link-bg)',
      }}
    >
      Support
    </Link>
    <Link
      to="/privacy"
      onClick={closeMenu}
      className="app-menu-link app-menu-link-account"
      style={{
        display: 'block',
        color: 'var(--app-menu-link-text)',
        textDecoration: 'none',
        padding: '12px',
        borderRadius: '8px',
        background: 'var(--app-menu-link-bg)',
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
        color: 'var(--app-menu-link-text)',
        textDecoration: 'none',
        padding: '12px',
        borderRadius: '8px',
        background: 'var(--app-menu-link-bg)',
      }}
    >
      Terms & Consent
    </Link>
    {currentUser ? (
      <button
        type="button"
        onClick={() => {
          closeMenu()
          void handleTopbarLogout()
        }}
        className="app-menu-link app-menu-link-account"
        style={{
          display: 'block',
          color: 'var(--app-menu-link-text)',
          textDecoration: 'none',
          padding: '12px',
          borderRadius: '8px',
          background: 'var(--app-menu-link-bg)',
          border: 'none',
          textAlign: 'left',
        }}
      >
        Sign Out
      </button>
    ) : null}
  </div>
  
)}

</header>
      ) : null}
  {/* PAGE CONTENT */}
      <main className={`content${isLoginRoute ? ' content-login' : ''}`}>
        <Suspense fallback={<div className="card">Loading page...</div>}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <Navigate to="/financial-health-summary" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  {isBorrowerSubscriber ? <Navigate to="/lending-scorecard" replace /> : <DashboardSnapshot />}
                </ProtectedRoute>
              }
            />

            <Route
              path="/snapshot"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE]}>
                  {isBorrowerSubscriber ? <Navigate to="/lending-scorecard" replace /> : <Snapshot />}
                </ProtectedRoute>
              }
            />

            <Route
              path="/lending-scorecard"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <LendingScorecard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/lending-scorecard/filscore"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <LendingScorecard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/loan-repository"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]} permissions={['read:loans']}>
                  <LoanRepository />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loan-applications"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]} permissions={['read:loans']}>
                  <LoanRepository />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loan-details/:applicationNo"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]} permissions={['read:loans']}>
                  <LoanDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loan-certification"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]} permissions={['read:loans']}>
                  <LoanCertificationPage />
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
                <ProtectedRoute permissions={['approve:loans']}>
                  <CreditReviewWorkbench />
                </ProtectedRoute>
              }
            />

            <Route
              path="/released-accounts"
              element={
                <ProtectedRoute permissions={['final_approve:loans']}>
                  <ReleasedAccounts />
                </ProtectedRoute>
              }
            />

            <Route
              path="/loan-dashboard"
              element={authenticatedPage(<LegacyLoanDashboard />)}
            />

            <Route
              path="/borrower-profile"
              element={authenticatedPage(<LegacyBorrowerProfile />)}
            />

            <Route
              path="/credit-committee-review"
              element={authenticatedPage(<LegacyCreditCommitteeReview />)}
            />

            <Route
              path="/scoring-audit-trail-panel"
              element={authenticatedPage(<LegacyScoringAuditTrailPanel />)}
            />

            <Route
              path="/scoring/audit-trail-panel"
              element={authenticatedPage(<LegacyScoringAuditTrailPanel />)}
            />

            <Route
              path="/lease-scorecard"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE]}>
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
              path="/budget-expense-tracker"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <BudgetExpenseTrackerPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/loan-monitoring"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <LoanMonitoringPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/bill-reminder"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <BillReminderPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/collateral-monitoring"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <CollateralMonitoringPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/net-worth-positioning"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <NetWorthPositioningPage />
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
                <ProtectedRoute roles={['admin']}>
                  <SubscriptionPaymentPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/subscription/payment"
              element={
                <ProtectedRoute roles={['admin']}>
                  <SubscriptionPaymentPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/billing"
              element={
                <ProtectedRoute roles={['admin']}>
                  <BillingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/invoices"
              element={
                <ProtectedRoute roles={['admin']}>
                  <BillingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/payment-history"
              element={
                <ProtectedRoute roles={['admin']}>
                  <BillingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/audit-trail"
              element={
                <ProtectedRoute roles={['admin']} permissions={['read:audit_logs']}>
                  <AuditTrailPanel />
                </ProtectedRoute>
              }
            />

            {/* RISK MANAGEMENT */}
            <Route
              path="/risk-management"
              element={
                <ProtectedRoute roles={['admin']} permissions={['read:audit_logs']}>
                  <RiskManagementPage />
                </ProtectedRoute>
              }
            />

            {/* COMPLIANCE */}
            <Route
              path="/compliance"
              element={
                <ProtectedRoute roles={['admin']} permissions={['read:audit_logs']}>
                  <CompliancePage />
                </ProtectedRoute>
              }
            />

            {/* AI ROUTES */}
            <Route
              path="/ai-dashboard"
              element={authenticatedPage(<AIDashboard />)}
            />

            <Route
              path="/chat-assistant"
              element={authenticatedPage(<ChatAssistant />)}
            />

            <Route
              path="/voice-reports"
              element={authenticatedPage(<VoiceReports />)}
            />

            <Route
              path="/ocr-scanner"
              element={authenticatedPage(<OCRScanner />)}
            />

            <Route
              path="/maintenance-ai"
              element={authenticatedPage(<MaintenanceAI />)}
            />

            <Route
              path="/risk-analysis"
              element={authenticatedPage(<RiskAnalysis />)}
            />

            <Route
              path="/pdf-summarizer"
              element={authenticatedPage(<PDFSummarizer />)}
            />

            <Route
              path="/meeting-minutes"
              element={authenticatedPage(<MeetingMinutes />)}
            />

            <Route
              path="/send-email"
              element={authenticatedPage(<SendEmail />)}
            />

            <Route
              path="/attend-meeting"
              element={authenticatedPage(<AttendMeeting />)}
            />

            <Route
              path="/compliance-ai"
              element={authenticatedPage(<ComplianceAI />)}
            />
            <Route
               path="/ai/history"
               element={authenticatedPage(<MeetingHistory />)}
            />

            <Route
              path="/ai/history/:id"
              element={authenticatedPage(<MeetingDetails />)}
            />

            <Route
              path="/meeting-history"
              element={authenticatedPage(<MeetingHistory />)}
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
              path="/trial-expired"
              element={<TrialExpiredReminderPage />}
            />

            <Route
              path="/trial-expired/payment"
              element={<TrialExpiredReminderPage />}
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
              element={authenticatedPage(<AccountSettingsPage />, [])}
            />

            <Route
              path="/financial-health-summary"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <FinancialHealthSummaryPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={authenticatedPage(<AccountSettingsPage />, [])}
            />

            <Route
              path="/about-filscore"
              element={<AboutFilscorePage />}
            />

            <Route
              path="/support"
              element={<SupportPage />}
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
              path="/subscription-fees"
              element={
                <ProtectedRoute roles={['admin']}>
                  <SubscriptionFeesPage />
                </ProtectedRoute>
              }
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

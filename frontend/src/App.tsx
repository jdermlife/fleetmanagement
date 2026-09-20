import { Suspense, lazy, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { fetchCurrentUser, getAuthToken, getMySubscription, logout, type LoginResponse } from './api'
import {
  SUBSCRIBER_BORROWER_ROLE,
  SUBSCRIBER_LENDER_ROLE,
  SUBSCRIBER_ROLE,
  isBorrowerSubscriberRole,
  isLenderSubscriberRole,
} from './authRoles'
import { APP_NAME, APP_TAGLINE, brandLogoDataUri } from './brand'
import AuthProgressOverlay from './components/auth/AuthProgressOverlay'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AutosaveStatus from './components/AutosaveStatus'
import FloatingChatbot from './components/ai/FloatingChatbot'
import { synchronizeBuildProfileDraft } from './autosave/buildProfileSync'
import { prepareAutosavesForLogout } from './autosave/useAutosaveDraft'
import { isAdminUser } from './hooks/useAuthorization'

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
      if (typeof window !== 'undefined') {
        const failedAsset = String(error).match(/https?:\/\/[^\s]+\.js/)?.[0] ?? String(error)
        const retryKey = `lazy-retry:${failedAsset}`

        if (!sessionStorage.getItem(retryKey)) {
          sessionStorage.setItem(retryKey, '1')
          const refreshUrl = new URL(window.location.href)
          refreshUrl.searchParams.set('__lazy_retry', Date.now().toString())
          window.location.replace(refreshUrl)
        }
      }
      throw error
    }
  })
}


const FinancialHealthSummaryPage = lazyWithRetry(() => import('./pages/scoring/FinancialHealthSummaryPage'))
const FinancialHealthJourneyPage = lazyWithRetry(() => import('./pages/scoring/FinancialHealthJourneyPage'))
const FinancialDecisions = lazyWithRetry(() => import('./pages/scoring/FinancialDecisions'))
const BuildProfilePage = lazyWithRetry(() => import('./pages/scoring/BuildProfilePage'))
const LendingScorecard = lazyWithRetry(() => import('./pages/scoring/LendingScorecard'))
const LeaseScorecardPage = lazy(() => import('./pages/scoring/LeaseScorecardPage'))
const InsuranceManagementPage = lazy(() => import('./pages/insurance/InsuranceManagementPage'))
const CreditScoring = lazy(() => import('./pages/scoring/CreditScoring'))
const BudgetExpenseTrackerPage = lazy(() => import('./pages/scoring/BudgetExpenseTrackerPage'))
const LoanMonitoringPage = lazy(() => import('./pages/scoring/LoanMonitoringPage'))
const BillReminderPage = lazy(() => import('./pages/scoring/BillReminderPage'))
const DashboardSnapshot = lazyWithRetry(() => import('./pages/dashboard/PortfolioAnalyticsDashboard'))
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
const ReturnRefundPolicyPage = lazy(() => import('./pages/legal/ReturnRefundPolicyPage'))
const CustomerServicePage = lazy(() => import('./pages/legal/CustomerServicePage'))
const DisputeResolutionPage = lazy(() => import('./pages/legal/DisputeResolutionPage'))
const SubscriptionFeesPage = lazy(() => import('./pages/legal/SubscriptionFeesPage'))
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'))
const RoleManagementPage = lazy(() => import('./pages/admin/RoleManagementPage'))
const PermissionManagementPage = lazy(() => import('./pages/admin/PermissionManagementPage'))
const CreditHealthMultiProductPage = lazy(() => import('./pages/admin/CreditHealthMultiProductPage'))
const CalculationPage = lazy(() => import('./pages/admin/CalculationPage'))
const AmlKycScoringPage = lazy(() => import('./pages/admin/AmlKycScoringPage'))
const AboutFilscoreMobilePage = lazy(() => import('./pages/admin/AboutFilscoreMobilePage'))
const SubscriptionManagementPage = lazyWithRetry(() => import('./pages/subscriptions/SubscriptionManagementPage'))
const SubscriptionPaymentPage = lazyWithRetry(() => import('./pages/subscriptions/SubscriptionPaymentPage'))
const PaymentSuccessPage = lazyWithRetry(() => import('./pages/subscriptions/PaymentSuccessPage'))
const PaymentCancelPage = lazyWithRetry(() => import('./pages/payment/cancel'))
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
  { id: 'build-profile', label: 'Profile' },
  { id: 'financial-health-summary', label: 'Financial Health' },
  { id: 'lending-scorecard', label: 'Credit Health Score' },
  { id: 'net-worth-positioning', label: 'Wealth Building Score' },
  { id: 'budget-expense-tracker', label: 'Budget Tracker' },
  { id: 'loan-monitoring', label: 'Resource Optimizer' },
  { id: 'bill-reminder', label: 'Bill Manager' },
  { id: 'financial-decisions', label: 'Financial Decisions' },
  { id: 'dashboard', label: 'Multiple Accounts' },

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
  { id: 'calculation', label: 'Calculation Models' },
  { id: 'aml-kyc-scoring', label: 'AML / KYC Scoring' },
  { id: 'credit-health-multi-product', label: 'Credit Health Multi' },
  { id: 'admin-users', label: 'User Management' },
  { id: 'admin-roles', label: 'Admin Role Management' },
  { id: 'admin-permissions', label: 'Permission Management' },
  { id: 'about-filscore-mobile', label: 'About FILSCORE for Apps' },
  { id: 'subscription-payment', label: 'Subscription Payment' },
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

function RegistrationAccessNotice({ title, description }: { title: string; description: string }) {
  return (
    <section className="financial-health-registration-notice" aria-labelledby="registration-access-title">
      <span>Free FILSCORE access</span>
      <h2 id="registration-access-title">{title}</h2>
      <p>{description}</p>
      <div className="financial-health-registration-actions">
        <Link to="/register" className="financial-health-registration-primary">Register Now</Link>
        <Link to="/login" className="financial-health-registration-secondary">Sign In</Link>
      </div>
    </section>
  )
}

function SubscriptionAccessNotice({ verificationFailed = false }: { verificationFailed?: boolean }) {
  return (
    <section className="financial-health-registration-notice" aria-labelledby="subscription-access-title">
      <span>{verificationFailed ? 'Subscription check unavailable' : 'Monthly subscription required'}</span>
      <h2 id="subscription-access-title">
        {verificationFailed ? 'Verify your subscription to continue' : 'Subscribe to access Lending Scorecard'}
      </h2>
      <p>
        {verificationFailed
          ? 'We could not confirm your subscription. Review your account subscription, then return to the Lending Scorecard.'
          : 'Your trial includes a preview of Credit Health. Choose a monthly plan to use the Lending Scorecard and receive your FILSCORE assessment.'}
      </p>
      <div className="financial-health-registration-actions">
        <Link to={verificationFailed ? '/subscriptions' : '/subscription-payment'} className="financial-health-registration-primary">
          {verificationFailed ? 'Manage Subscription' : 'View Monthly Plans'}
        </Link>
        <Link to="/financial-health-journey" className="financial-health-registration-secondary">Back to Journey</Link>
      </div>
    </section>
  )
}

function CreditHealthScorecardPreview() {
  return (
    <div className="psychometric-page lending-psychometric-page credit-health-access-preview">
      <section className="psychometric-hero lending-psychometric-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Advanced readiness for origination workflow</span>
          <h1>Credit Health</h1>
          <p>Credit Health combines credit, social, and psychometric indicators into one readiness assessment.</p>
        </div>
      </section>
      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>FILSCORE</span>
          <strong>--</strong>
          <small>Complete your profile to calculate</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Credit Score</span>
          <strong>--</strong>
          <small>Awaiting assessment data</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Readiness</span>
          <strong>Pending</strong>
          <small>Registration required</small>
        </article>
      </section>
      <section className="psychometric-panel">
        <span className="psychometric-panel-kicker">Financial Health Journey</span>
        <h2>Credit Health Assessment</h2>
        <p>Build your financial profile to unlock detailed scoring, risk indicators, and personalized recommendations.</p>
      </section>
    </div>
  )
}

function LendingScorecardAccessGate({
  authReady,
  currentUser,
}: {
  authReady: boolean
  currentUser: LoginResponse['user'] | null
}) {
  const [accessState, setAccessState] = useState<'loading' | 'granted' | 'subscription-required' | 'verification-failed'>('loading')
  const isAdmin = isAdminUser(currentUser)

  useEffect(() => {
    if (!authReady || !currentUser) {
      setAccessState('loading')
      return
    }

    if (isAdmin) {
      setAccessState('granted')
      return
    }

    let cancelled = false
    setAccessState('loading')
    void getMySubscription()
      .then((subscription) => {
        if (cancelled) return
        const hasPaidAccess = subscription?.status === 'ACTIVE'
          && (subscription.subscription_type === 'PAID' || subscription.subscription_type === 'LIFETIME')
        setAccessState(hasPaidAccess ? 'granted' : 'subscription-required')
      })
      .catch(() => {
        if (!cancelled) setAccessState('verification-failed')
      })

    return () => {
      cancelled = true
    }
  }, [authReady, currentUser, isAdmin])

  if (!authReady || (currentUser && accessState === 'loading')) {
    return <div className="card" role="status">Checking account...</div>
  }

  if (!currentUser) {
    return (
      <div className="financial-health-registration-gate">
        <div className="financial-health-registration-preview" aria-hidden="true">
          <CreditHealthScorecardPreview />
        </div>
        <RegistrationAccessNotice
          title="Register to access Credit Health Scorecard"
          description="Profile is required as basis of Credit Health assessment. Enjoy a complimentary 2‑day trial to explore all premium features before committing."
        />
      </div>
    )
  }

  if (accessState !== 'granted') {
    return (
      <div className="financial-health-registration-gate">
        <div className="financial-health-registration-preview" aria-hidden="true">
          <CreditHealthScorecardPreview />
        </div>
        <SubscriptionAccessNotice verificationFailed={accessState === 'verification-failed'} />
      </div>
    )
  }

  return (
    <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
      <LendingScorecard />
    </ProtectedRoute>
  )
}

function NetWorthPositioningPreview() {
  return (
    <div className="psychometric-page networth-dashboard-page networth-access-preview">
      <section className="psychometric-hero networth-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Net Worth and Goal Tracking</span>
          <h1>Wealth Builder</h1>
          <p>Understand your current position, define financial goals, and track progress toward sustainable wealth.</p>
        </div>
      </section>
      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Net Worth Position</span>
          <strong>--</strong>
          <small>Complete your profile to calculate</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Assets</span>
          <strong>--</strong>
          <small>Awaiting financial information</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Goal Progress</span>
          <strong>Pending</strong>
          <small>Registration required</small>
        </article>
      </section>
      <section className="psychometric-panel">
        <span className="psychometric-panel-kicker">Financial Health Journey</span>
        <h2>Net Worth Positioning</h2>
        <p>Build your balance sheet and goals to unlock wealth-building insights and recommendations.</p>
      </section>
    </div>
  )
}

function BudgetExpenseTrackerPreview() {
  return (
    <div className="psychometric-page budget-dashboard-page budget-access-preview">
      <section className="psychometric-hero budget-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Budget and Cash Flow Planning</span>
          <h1>Budget &amp; Expense Tracker</h1>
          <p>Set monthly targets, monitor actual spending, and understand how cash flow affects your financial health.</p>
        </div>
      </section>
      <section className="psychometric-summary-grid budget-dashboard-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Monthly Income</span>
          <strong>--</strong>
          <small>Complete your profile to calculate</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Planned Expenses</span>
          <strong>--</strong>
          <small>Awaiting budget targets</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Cash Flow</span>
          <strong>Pending</strong>
          <small>Registration required</small>
        </article>
      </section>
      <section className="psychometric-panel">
        <span className="psychometric-panel-kicker">Financial Health Journey</span>
        <h2>Budget Readiness</h2>
        <p>Build your budget to unlock spending analysis, savings targets, and personalized cash-flow recommendations.</p>
      </section>
    </div>
  )
}

function ResourceOptimizerPreview() {
  return (
    <div className="psychometric-page loan-monitoring-dashboard-page resource-optimizer-access-preview">
      <section className="psychometric-hero loan-monitoring-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Resources Performance Oversight</span>
          <h1>Resource Optimizer</h1>
          <p>Monitor loans, cash resources, and collateral performance to improve financial efficiency and resilience.</p>
        </div>
      </section>
      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Loan Position</span>
          <strong>--</strong>
          <small>Complete your profile to calculate</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Resource Efficiency</span>
          <strong>--</strong>
          <small>Awaiting account information</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Optimization Status</span>
          <strong>Pending</strong>
          <small>Registration required</small>
        </article>
      </section>
      <section className="psychometric-panel">
        <span className="psychometric-panel-kicker">Financial Health Journey</span>
        <h2>Loan Monitoring</h2>
        <p>Add your loans and resources to unlock performance monitoring and personalized optimization recommendations.</p>
      </section>
    </div>
  )
}

function BillManagerPreview() {
  return (
    <div className="psychometric-page bill-reminder-dashboard-page bill-manager-access-preview">
      <section className="psychometric-hero bill-reminder-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Billing Workflow Controls</span>
          <h1>Bill Manager</h1>
          <p>Organize recurring bills, monitor due dates, and strengthen payment reliability across each billing cycle.</p>
        </div>
      </section>
      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Upcoming Bills</span>
          <strong>--</strong>
          <small>Complete your profile to calculate</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Monthly Commitments</span>
          <strong>--</strong>
          <small>Awaiting billing information</small>
        </article>
        <article className="psychometric-summary-card">
          <span>Payment Status</span>
          <strong>Pending</strong>
          <small>Registration required</small>
        </article>
      </section>
      <section className="psychometric-panel">
        <span className="psychometric-panel-kicker">Financial Health Journey</span>
        <h2>Bill Reminder</h2>
        <p>Add your recurring bills to unlock due-date monitoring, payment tracking, and timely reminders.</p>
      </section>
    </div>
  )
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<LoginResponse['user'] | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profileSyncReady, setProfileSyncReady] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [fleetOpen, setFleetOpen] = useState(true)
  const [aiOpen, setAiOpen] = useState(true)
  const [govOpen, setGovOpen] = useState(true)
  const [adminOpen, setAdminOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(true)

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
  'calculation',
  'aml-kyc-scoring',
  'credit-health-multi-product',
  'admin-users',
  'admin-roles',
  'admin-permissions',
  'about-filscore-mobile',
  'subscription-payment',
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
  'subscription-payment',
  'admin-users',
  'admin-roles',
  'admin-permissions',
  'about-filscore-mobile',
  'trial-expired',
]

const subscriberAlwaysVisibleMenus = [
  'build-profile',
  'financial-health-summary',
  'financial-decisions',
  'lending-scorecard',
  'budget-expense-tracker',
  'loan-monitoring',
  'bill-reminder',
  'collateral-monitoring',
  'net-worth-positioning',
]

const borrowerVisibleMenus = [
  'build-profile',
  'financial-health-summary',
  'financial-decisions',
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
const currentUserId = currentUser?.id
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
const isPaymentSuccessRoute = ['/payment-success', '/payment/success', '/payment/cancel'].includes(location.pathname)
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
  }, [currentUser, location.pathname, location.search])

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

  useEffect(() => {
    if (!currentUserId) {
      setProfileSyncReady(false)
      return
    }

    let cancelled = false
    setProfileSyncReady(false)
    void synchronizeBuildProfileDraft()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setProfileSyncReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [currentUserId])

  const handleTopbarLogout = async () => {
    setIsSigningOut(true)
    try {
      await prepareAutosavesForLogout()
      await logout()
      setCurrentUser(null)
      navigate('/login')
    } finally {
      setIsSigningOut(false)
    }
  }

  useEffect(() => {
    const handleSessionExpired = () => {
      setCurrentUser(null)
      if (!isPaymentSuccessRoute) {
        navigate('/login')
      }
    }
    window.addEventListener('auth:session-expired', handleSessionExpired)
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired)
  }, [isPaymentSuccessRoute, navigate])

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
                <div className="app-brand-subtitle-row">
                  <p className="app-brand-subtitle">{APP_TAGLINE}</p>
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

    <button
      type="button"
      onClick={() => setFleetOpen(!fleetOpen)}
      className="app-menu-group app-menu-group-fleet app-menu-group-toggle"
      aria-expanded={fleetOpen}
      style={{
        background: 'var(--app-menu-group-fleet-bg)',
        color: 'var(--app-menu-group-fleet-text)',
        padding: '12px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
      }}
    >
      <span>TOOLS</span>
      <span className="app-menu-group-arrow" aria-hidden="true">{fleetOpen ? '▲' : '▼'}</span>
    </button>

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

        <button
          type="button"
          onClick={() => setAiOpen(!aiOpen)}
          className="app-menu-group app-menu-group-ai app-menu-group-toggle"
          aria-expanded={aiOpen}
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
          <span>🤖 AI TOOLS</span>
          <span className="app-menu-group-arrow" aria-hidden="true">{aiOpen ? '▲' : '▼'}</span>
        </button>

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
        <button
          type="button"
          onClick={() => setAdminOpen(!adminOpen)}
          className="app-menu-group app-menu-group-account app-menu-group-toggle"
          aria-expanded={adminOpen}
          style={{
            background: 'var(--app-menu-group-admin-bg)',
            color: 'var(--app-menu-group-admin-text)',
            padding: '12px',
            borderRadius: '8px',
            fontWeight: 'bold',
            marginTop: '10px',
          }}
        >
          <span>ADMINISTRATION</span>
          <span className="app-menu-group-arrow" aria-hidden="true">{adminOpen ? '▲' : '▼'}</span>
        </button>
        {adminOpen && adminMenuItems.map((page) => (
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

        <button
          type="button"
          onClick={() => setGovOpen(!govOpen)}
          className="app-menu-group app-menu-group-governance app-menu-group-toggle"
          aria-expanded={govOpen}
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
          <span>🛡 GOVERNANCE</span>
          <span className="app-menu-group-arrow" aria-hidden="true">{govOpen ? '▲' : '▼'}</span>
        </button>

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

    <button
      type="button"
      onClick={() => setProfileOpen(!profileOpen)}
      className="app-menu-group app-menu-group-account app-menu-group-toggle"
      aria-expanded={profileOpen}
      style={{
        background: 'var(--app-menu-group-account-bg)',
        color: 'var(--app-menu-group-account-text)',
        padding: '12px',
        borderRadius: '8px',
        fontWeight: 'bold',
        marginTop: '10px',
      }}
    >
      <span>PROFILE</span>
      <span className="app-menu-group-arrow" aria-hidden="true">{profileOpen ? '▲' : '▼'}</span>
    </button>

    {profileOpen ? (
      <>
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
      </>
    ) : null}
    {currentUser ? (
      <button
        type="button"
        disabled={isSigningOut}
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
          {currentUser && !profileSyncReady ? (
            <div className="card" role="status">Synchronizing profile...</div>
          ) : (
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
              path="/build-profile"
              element={
                !authReady ? (
                  <div className="card" role="status">Checking account...</div>
                ) : currentUser ? (
                  <ProtectedRoute>
                    <BuildProfilePage />
                  </ProtectedRoute>
                ) : (
                  <div className="financial-health-registration-gate">
                    <div className="financial-health-registration-preview" aria-hidden="true">
                      <BuildProfilePage />
                    </div>
                    <RegistrationAccessNotice
                      title="Create  profile"
                      description="Profile is required as basis of financial position, analysis, scores and recommendations.Enjoy a complimentary 2‑day trial to explore all premium features before committing."
                    />
                  </div>
                )
              }
            />

            <Route
              path="/lending-scorecard"
              element={<LendingScorecardAccessGate authReady={authReady} currentUser={currentUser} />}
            />

            <Route
              path="/lending-scorecard/filscore"
              element={<LendingScorecardAccessGate authReady={authReady} currentUser={currentUser} />}
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
                !authReady ? (
                  <div className="card" role="status">Checking account...</div>
                ) : currentUser ? (
                  <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                    <BudgetExpenseTrackerPage />
                  </ProtectedRoute>
                ) : (
                  <div className="financial-health-registration-gate">
                    <div className="financial-health-registration-preview" aria-hidden="true">
                      <BudgetExpenseTrackerPreview />
                    </div>
                    <RegistrationAccessNotice
                      title="Register to access Budget & Expense Tracker"
                      description="Profile is required to set budget targets, monitor spending, and receive personalized cash-flow recommendations."
                    />
                  </div>
                )
              }
            />

            <Route
              path="/loan-monitoring"
              element={
                !authReady ? (
                  <div className="card" role="status">Checking account...</div>
                ) : currentUser ? (
                  <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                    <LoanMonitoringPage />
                  </ProtectedRoute>
                ) : (
                  <div className="financial-health-registration-gate">
                    <div className="financial-health-registration-preview" aria-hidden="true">
                      <ResourceOptimizerPreview />
                    </div>
                    <RegistrationAccessNotice
                      title="Create Account  to access Resource Optimizer"
                      description="Profile is required as basis of monitoring resources triggers and receiving optimization recommendations.Enjoy a complimentary 2‑day trial."
                    />
                  </div>
                )
              }
            />

            <Route
              path="/bill-reminder"
              element={
                !authReady ? (
                  <div className="card" role="status">Checking account...</div>
                ) : currentUser ? (
                  <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                    <BillReminderPage />
                  </ProtectedRoute>
                ) : (
                  <div className="financial-health-registration-gate">
                    <div className="financial-health-registration-preview" aria-hidden="true">
                      <BillManagerPreview />
                    </div>
                    <RegistrationAccessNotice
                      title="Create Profile to access Bill Manager"
                      description="Create account as reference to organize bills, monitor due dates, and receive timely payment reminders.Enjoy a complimentary 2‑day trial."
                    />
                  </div>
                )
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
                !authReady ? (
                  <div className="card" role="status">Checking account...</div>
                ) : currentUser ? (
                  <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                    <NetWorthPositioningPage />
                  </ProtectedRoute>
                ) : (
                  <div className="financial-health-registration-gate">
                    <div className="financial-health-registration-preview" aria-hidden="true">
                      <NetWorthPositioningPreview />
                    </div>
                    <RegistrationAccessNotice
                      title="Register to access Wealth Builder"
                      description="Financial profile is required to build net worth position, set financial goals, and receive specific wealth management recommendations.Enjoy a complimentary 2‑day trial."
                    />
                  </div>
                )
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
                <ProtectedRoute>
                  <SubscriptionPaymentPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/subscription/payment"
              element={<SubscriptionPaymentPage />}
            />

            <Route
              path="/payment-success"
              element={<PaymentSuccessPage />}
            />

            <Route
              path="/payment/success"
              element={<PaymentSuccessPage />}
            />

            <Route
              path="/payment/cancel"
              element={<PaymentCancelPage />}
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
              element={<SubscriptionPaymentPage />}
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
                !authReady ? (
                  <div className="card" role="status">Checking account...</div>
                ) : currentUser ? (
                  <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                    <FinancialHealthSummaryPage />
                  </ProtectedRoute>
                ) : (
                  <div className="financial-health-registration-gate">
                    <div className="financial-health-registration-preview" aria-hidden="true">
                      <FinancialHealthSummaryPage />
                    </div>
                    <RegistrationAccessNotice
                      title="Register to Unlock Your Financial Health"
                      description="Enjoy a complimentary 2‑day trial."
                    />
                  </div>
                )
              }
            />

            <Route
              path="/financial-health-journey"
              element={<FinancialHealthJourneyPage />}
            />

            <Route
              path="/financial-decisions"
              element={
                <ProtectedRoute roles={['admin', SUBSCRIBER_ROLE, SUBSCRIBER_LENDER_ROLE, SUBSCRIBER_BORROWER_ROLE]}>
                  <FinancialDecisions />
                </ProtectedRoute>
              }
            />

            <Route path="/affordability-advisor" element={<Navigate to="/financial-decisions" replace />} />

            <Route
              path="/calculation"
              element={
                <ProtectedRoute roles={['admin']}>
                  <CalculationPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/aml-kyc-scoring"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AmlKycScoringPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/about-filscore-mobile"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AboutFilscoreMobilePage />
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
              path="/return-refund-policy"
              element={<ReturnRefundPolicyPage />}
            />

            <Route
              path="/customer-service"
              element={<CustomerServicePage />}
            />

            <Route
              path="/dispute-resolution"
              element={<DisputeResolutionPage />}
            />

            <Route
              path="/fees"
              element={<SubscriptionFeesPage />}
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

            <Route
              path="/credit-health-multi-product"
              element={
                <ProtectedRoute roles={['admin']}>
                  <CreditHealthMultiProductPage />
                </ProtectedRoute>
              }
            />
          </Routes>
          )}
        </Suspense>
      </main>
      {!isLoginRoute && !isPaymentSuccessRoute ? (
        <FloatingChatbot
          pathname={location.pathname}
          authenticated={Boolean(currentUser)}
          ready={authReady}
        />
      ) : null}
      {isSigningOut ? (
        <AuthProgressOverlay
          idPrefix="app-signing-out"
          kicker="Secure session"
          title="Signing you out"
          description="Securing your saved work and closing your session."
          footnote="Please keep this window open."
        />
      ) : null}
    </div>
  )
}

export default App

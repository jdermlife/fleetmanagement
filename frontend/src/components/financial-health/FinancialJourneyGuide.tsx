import { useState } from 'react'

export type JourneyStepId = 'createProfile' | 'creditHealth' | 'wealthBuilder' | 'budgetTargets' | 'billsLoans' | 'billManager'

export type JourneyStep = {
  id: JourneyStepId
  label: string
  launchLabel: string
  route: string
  description: string
}

type JourneyDetailId = JourneyStepId | 'financialHealth'

type JourneyDetail = {
  title: string
  points: string[]
}

export const FINANCIAL_HEALTH_JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'createProfile',
    label: '1.Personalize',
    launchLabel: 'Create / Update Profile',
    route: '/build-profile',
    description: 'Create your financial profile first so each health score and recommendation can use your information.',
  },
  {
    id: 'creditHealth',
    label: '2. Loan & Wealth Ready?',
    launchLabel: 'Launch Credit Health',
    route: '/lending-scorecard',
    description: 'Launch the Credit Health section and complete your personal profile to improve score precision.',
  },
  {
    id: 'wealthBuilder',
    label: '3. Growth Ready?',
    launchLabel: 'Launch Wealth Builder',
    route: '/net-worth-positioning',
    description: 'Define long-term goals, complete your initial net worth profile, and record your assets and liabilities.',
  },
  {
    id: 'budgetTargets',
    label: '4. Budget Ready?',
    launchLabel: 'Budget & Expense Tracker',
    route: '/budget-expense-tracker',
    description: 'Set monthly income, spending limits, savings goals, and investment targets to track progress accurately.',
  },
  {
    id: 'billsLoans',
    label: '5. Resource Ready?',
    launchLabel: 'Resource Optimizer',
    route: '/loan-monitoring',
    description: 'Enter loans and credit obligations to get optimization recommendations.',
  },
  {
    id: 'billManager',
    label: '6. Bill Managed Ready?',
    launchLabel: 'Manage Bills',
    route: '/bill-reminder',
    description: 'Manage your bills.',
  },
]

const FINANCIAL_HEALTH_JOURNEY_DETAILS: Record<JourneyDetailId, JourneyDetail> = {
  createProfile: {
    title: 'Profile',
    points: [
      'Complete the 12-step workflow form to establish your Financial Health Summary.',
      'Enter zero, none, or not applicable where relevant.',
      'A completion percentage is displayed in the main dashboard.',
      'Each step is color-coded to highlight progress and pending items.',
    ],
  },
  creditHealth: {
    title: 'Credit Health',
    points: [
      'Derived from Credit Score, Non-Starter Score, Social Score, and Psychometric Score.',
      'Goes beyond numbers by reflecting reputation, reliability, and financial trustworthiness.',
      'Indicates the likelihood of loan approval and highlights areas for improvement.',
    ],
  },
  wealthBuilder: {
    title: 'Composite Wealth Score',
    points: [
      'Combines Net Worth Positioning, Wealth Behaviour, Wealth Foundation, and Wealth Authenticity.',
      'Answers: Where am I today?',
      'Answers: Why am I here?',
      'Answers: Where am I going?',
      'Answers: What should I do next?',
    ],
  },
  budgetTargets: {
    title: 'Budget & Expense Tracker',
    points: [
      'Guides budget setup and regular updates of actual expenses.',
      'Captures both financial discipline and behavioral patterns.',
      'Directly contributes to the Financial Health Score.',
    ],
  },
  billsLoans: {
    title: 'Resources Performance Oversight',
    points: [
      'Measures how Debt, Cash, and Collateral are optimized.',
      'Covers loan setup and loan statement management.',
      'Includes collateral tracking linked to the Profile section.',
      'Provides visibility into resource efficiency and risk exposure.',
    ],
  },
  billManager: {
    title: 'Bill Manager',
    points: [
      'Enables payment reminders and monitoring of billing cycles.',
      'Reduces missed payments and strengthens financial reliability.',
      'Integrates seamlessly into the Financial Health Scorecard.',
    ],
  },
  financialHealth: {
    title: 'Financial Health',
    points: [
      'Provides an overall assessment of financial stability and resilience.',
      'Captures Stability & Reliability, Control & Resilience, and Future Progress.',
      'Shows what your financial health is today.',
      'Shows how your income compares to your work.',
      'Highlights the risks and opportunities that lie ahead.',
    ],
  },
}

export const JOURNEY_MINIMIZED_STORAGE_KEY = 'fms:journey:minimized'
export const JOURNEY_DO_NOT_SHOW_STORAGE_KEY = 'fms:journey:do-not-show'

export function safeJourneyStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function safeJourneyStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.setItem(key, value)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function safeJourneyStorageRemove(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.removeItem(key)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

type FinancialJourneyGuideProps = {
  completion: Record<JourneyStepId, boolean>
  currentStep?: JourneyStepId
  doNotShowAgain: boolean
  isOpen: boolean
  onDoNotShowAgainChange: (checked: boolean) => void
  onLaunchStep: (step: JourneyStep) => void
  onMinimize: () => void
  onStart?: () => void
}

export default function FinancialJourneyGuide({
  completion,
  currentStep,
  doNotShowAgain,
  isOpen,
  onDoNotShowAgainChange,
  onLaunchStep,
  onMinimize,
  onStart = onMinimize,
}: FinancialJourneyGuideProps) {
  const [activeDetailId, setActiveDetailId] = useState<JourneyDetailId | null>(null)
  const completedCount = Object.values(completion).filter(Boolean).length
  const completionPercent = Math.round((completedCount / FINANCIAL_HEALTH_JOURNEY_STEPS.length) * 100)
  const activeDetail = activeDetailId ? FINANCIAL_HEALTH_JOURNEY_DETAILS[activeDetailId] : null

  if (!isOpen) return null

  return (
    <section className="financial-health-journey-overlay" role="dialog" aria-modal="true" aria-labelledby="financial-health-journey-title">
      <article className="financial-health-journey-modal">
        <button type="button" className="financial-health-journey-minimize" onClick={onMinimize} aria-label="Minimize Financial Health Journey">
          Minimize
        </button>

        <p className="financial-health-journey-kicker">GREETINGS! We wish you well today.</p>
        <h2 id="financial-health-journey-title">Welcome to Your Financial Health Journey!</h2>
        <p>
          Complete these steps to unlock the full power of your profile and receive more accurate financial recommendations.
          Hover over each circle to learn more, or select its button to launch that step.
        </p>

        <div className="financial-health-journey-step-list financial-health-journey-cycle" role="list" aria-label="Financial Health journey checklist">
          {FINANCIAL_HEALTH_JOURNEY_STEPS.map((step) => {
            const isCompleted = completion[step.id]
            return (
              <article
                key={step.id}
                className={`financial-health-journey-step ${isCompleted ? 'financial-health-journey-step-complete' : ''}${currentStep === step.id ? ' financial-health-journey-step-current' : ''}`}
                role="listitem"
                tabIndex={0}
                aria-current={currentStep === step.id ? 'step' : undefined}
                aria-describedby={activeDetailId === step.id ? 'financial-health-journey-detail' : undefined}
                onMouseEnter={() => setActiveDetailId(step.id)}
                onMouseLeave={() => setActiveDetailId(null)}
                onFocus={() => setActiveDetailId(step.id)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveDetailId(null)
                }}
              >
                <div className="financial-health-journey-step-copy">
                  {isCompleted ? <span className="financial-health-journey-step-check" aria-label="Completed">✓</span> : null}
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                </div>
                <button type="button" className="financial-health-journey-action" onClick={() => onLaunchStep(step)}>
                  {step.launchLabel}
                </button>
              </article>
            )
          })}

          <div
            className="financial-health-journey-hub"
            tabIndex={0}
            aria-describedby={activeDetailId === 'financialHealth' ? 'financial-health-journey-detail' : undefined}
            onMouseEnter={() => setActiveDetailId('financialHealth')}
            onMouseLeave={() => setActiveDetailId(null)}
            onFocus={() => setActiveDetailId('financialHealth')}
            onBlur={() => setActiveDetailId(null)}
          >
            <span>Financial Health</span>
          </div>

          {activeDetail ? (
            <aside id="financial-health-journey-detail" className="financial-health-journey-detail" role="tooltip">
              <strong>{activeDetail.title}</strong>
              <ul>{activeDetail.points.map((point) => <li key={point}>{point}</li>)}</ul>
            </aside>
          ) : null}

          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className={`financial-health-journey-arrow financial-health-journey-arrow-${index + 1}`} aria-hidden="true" />
          ))}
        </div>

        <button type="button" className="financial-health-journey-minimize" onClick={onStart} aria-label="Start Financial Health Journey">
          Start Now
        </button>

        <div className="financial-health-journey-progress" aria-live="polite">
          <h3>Financial Health Journey</h3>
          <div className="financial-health-journey-progress-list">
            {FINANCIAL_HEALTH_JOURNEY_STEPS.map((step) => (
              <span key={`progress-${step.id}`}>{completion[step.id] ? '☑' : '☐'} {step.label}</span>
            ))}
          </div>
          <strong>{completionPercent}% Complete</strong>
        </div>

        <label className="financial-health-journey-toggle">
          <input type="checkbox" checked={doNotShowAgain} onChange={(event) => onDoNotShowAgainChange(event.target.checked)} />
          <span>Do not show this welcome pop-up again</span>
        </label>

        {completionPercent >= 100 ? (
          <div className="financial-health-journey-complete">
            <p><strong>Excellent!</strong> Your Financial Health Profile is now established.</p>
            <button type="button" className="financial-health-journey-action" onClick={() => window.location.assign('/financial-health-summary')}>
              Go to Financial Health Dashboard
            </button>
          </div>
        ) : null}

        <button type="button" className="financial-health-journey-skip" onClick={onMinimize}>Skip for Now</button>
      </article>
    </section>
  )
}

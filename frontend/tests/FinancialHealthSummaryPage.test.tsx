import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchAutosaveDraft } = vi.hoisted(() => ({
  fetchAutosaveDraft: vi.fn(),
}))
const { authorization } = vi.hoisted(() => ({
  authorization: { isAdmin: true },
}))

vi.mock('../src/autosave/draftApi', () => ({
  fetchAutosaveDraft,
}))
vi.mock('../src/hooks/useAuthorization', () => ({
  useAuthorization: () => authorization,
}))

import FinancialHealthSummaryPage from '../src/pages/scoring/FinancialHealthSummaryPage'

describe('FinancialHealthSummaryPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    authorization.isAdmin = true
    fetchAutosaveDraft.mockReset()
    fetchAutosaveDraft.mockResolvedValue(null)
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() { return values.size },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    })
  })

  it('starts the Financial Health Journey with Create Profile before Credit Health', () => {
    render(<FinancialHealthSummaryPage />)

    const checklist = screen.getByRole('list', { name: 'Financial Health journey checklist' })
    const journeyItems = within(checklist).getAllByRole('listitem')

    expect(within(checklist).getByText('Financial Health', { selector: '.financial-health-journey-hub span' })).toBeTruthy()
    expect(within(journeyItems[0]).getByRole('heading', { name: 'Create/Update Profile' })).toBeTruthy()
    expect(within(journeyItems[0]).getByRole('button', { name: 'Create Profile' })).toBeTruthy()
    expect(within(journeyItems[1]).getByRole('heading', { name: 'Credit Health' })).toBeTruthy()
    expect(within(journeyItems[1]).getByRole('button', { name: 'Launch Credit Health' })).toBeTruthy()
  })

  it('reveals journey guidance when outer and central circles are hovered or focused', () => {
    render(<FinancialHealthSummaryPage />)

    const checklist = screen.getByRole('list', { name: 'Financial Health journey checklist' })
    const journeyItems = within(checklist).getAllByRole('listitem')
    fireEvent.mouseEnter(journeyItems[0])
    expect(screen.getByRole('tooltip').textContent).toContain('Complete the 12-step workflow form')
    fireEvent.mouseLeave(journeyItems[0])
    expect(screen.queryByRole('tooltip')).toBeNull()

    const financialHealthCircle = within(checklist).getByText('Financial Health', {
      selector: '.financial-health-journey-hub span',
    }).parentElement
    expect(financialHealthCircle).toBeTruthy()
    fireEvent.focus(financialHealthCircle as HTMLElement)
    expect(screen.getByRole('tooltip').textContent).toContain('overall assessment of financial stability and resilience')
    expect(screen.getByRole('tooltip').textContent).toContain('risks and opportunities that lie ahead')
    fireEvent.blur(financialHealthCircle as HTMLElement)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('places the minimized journey opener between the model note and compute button', () => {
    window.localStorage.setItem('fms:journey:minimized', '1')
    render(<FinancialHealthSummaryPage />)

    const computeBar = screen.getByRole('region', { name: 'Financial Health computation controls' })
    const modelNote = within(computeBar).getByText('Default Financial Health model displayed')
    const journeyButton = within(computeBar).getByRole('button', { name: 'Open Financial Health Journey' })
    const computeButton = within(computeBar).getByRole('button', { name: 'Compute Latest Financial Health' })

    expect(modelNote.compareDocumentPosition(journeyButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(journeyButton.compareDocumentPosition(computeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows APP identity and Step 8 financial amounts in thousands', async () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-USER',
      values: {
        fullName: 'Jane Doe',
        'asset-cash-on-hand': '1500000',
        'liability-personal-loan': '250000',
        'income-salary': '120000',
        'expense-housing': '20000',
        'insurance-life': '500000',
        'insurance-health': '250000',
        'wealthActual.asset-cash-on-hand': '9999999',
      },
      documents: [],
      suitabilityAnswers: {},
      coBorrowers: [],
      guarantors: [],
      additionalCollaterals: [],
    }))

    render(<FinancialHealthSummaryPage />)

    const profileLine = screen.getByRole('region', { name: 'Selected financial health profile' })
    expect(within(profileLine).getByText('Record ID')).toBeTruthy()
    expect(within(profileLine).getByText('Jane Doe')).toBeTruthy()
    expect(await within(profileLine).findByText('1,250k')).toBeTruthy()
    expect(within(profileLine).getByText('100k')).toBeTruthy()
    expect(within(profileLine).getByText('750k')).toBeTruthy()
  })

  it('shows saved-data recommendations for each Financial Position ring', async () => {
    fetchAutosaveDraft.mockImplementation((scope: string) => Promise.resolve(
      scope === 'net-worth-positioning'
        ? {
            payload: {
              amounts: {
                'asset-savings-account': 500000,
                'liability-personal-loan': 100000,
                'income-salary': 100000,
                'expense-housing': 60000,
              },
              selectedFinancialGoal: 'Grow net worth',
              targetAmount: 1000000,
              targetMonths: 12,
            },
          }
        : scope === 'loan-application'
          ? {
              payload: {
                formData: {
                  borrower: { govId: 'ID-123' },
                  employment: { monthlyIncome: 100000, debtObligations: 5000 },
                  loan: { amount: 120000, interestRate: 0, termMonths: 12 },
                  documents: [{ status: 'Parsed' }, { status: 'Pending' }],
                },
              },
            }
          : null,
    ))

    render(<FinancialHealthSummaryPage />)

    const rings = await screen.findByRole('region', { name: 'Financial Position Rings' })
    const cashFlowRing = within(rings).getByRole('progressbar', { name: /Cash Flow Position Ring/ })
    fireEvent.mouseEnter(cashFlowRing)
    expect(screen.getByRole('tooltip').textContent).toContain('saved monthly surplus is ₱40,000')
    expect(screen.getByRole('tooltip').textContent).toContain('40.0% of income')
    fireEvent.mouseLeave(cashFlowRing)

    const creditRing = within(rings).getByRole('progressbar', { name: /Credit Health Ring/ })
    fireEvent.focus(creditRing)
    expect(screen.getByRole('tooltip').textContent).toContain('₱100,000 in monthly income')
    expect(screen.getByRole('tooltip').textContent).toContain('₱15,000 in monthly debt commitments')
    expect(screen.getByRole('tooltip').textContent).toContain('Complete verification for 1 outstanding document')
    fireEvent.blur(creditRing)

    const netWorthRing = within(rings).getByRole('progressbar', { name: /Net Worth Growth Ring/ })
    fireEvent.mouseEnter(netWorthRing)
    const recommendation = screen.getByRole('tooltip')
    expect(recommendation.textContent).toContain('saved net worth is ₱400,000')
    expect(recommendation.textContent).toContain('projected goal-date net worth of ₱880,000')
    expect(recommendation.textContent).not.toMatch(/formula|threshold|weight|scoring rule/i)
  })

  it('places profile product recommendations between summary metrics and health indicators', () => {
    render(<FinancialHealthSummaryPage />)

    const computationSources = screen.getByRole('region', { name: 'Computation Sources' })
    const recommendedProducts = within(computationSources).getByRole('region', {
      name: 'Recommended Products for this Profile',
    })
    expect(within(recommendedProducts).getByText('Investment Readiness Plan')).toBeTruthy()
    expect(within(recommendedProducts).getByText('Protection Gap Review')).toBeTruthy()
    expect(within(recommendedProducts).getByText('Wealth Builder')).toBeTruthy()
    expect(within(recommendedProducts).getByText('71/100')).toBeTruthy()

    const summaryMetrics = within(computationSources).getByText('Summary metrics')
    const healthIndicators = within(computationSources).getByText('Health indicators')
    expect(summaryMetrics.compareDocumentPosition(recommendedProducts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(recommendedProducts.compareDocumentPosition(healthIndicators) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the score, band, indicators, and transparent formula', () => {
    render(<FinancialHealthSummaryPage />)

    expect(screen.getByRole('heading', { name: 'Financial Health' })).toBeTruthy()
    expect(screen.getByText('842', { selector: '.financial-health-ring-score strong' })).toBeTruthy()
    expect(screen.getAllByText('Excellent').length).toBeGreaterThan(0)
    expect(screen.getByText('84.2 × 10 = 842')).toBeTruthy()
    expect(screen.getAllByRole('heading', { name: 'Credit Health' })).toHaveLength(4)
    expect(screen.getByText('Awaiting a saved loan application draft to paint the leaf with live lending scores.')).toBeTruthy()
    const trendGraph = screen.getByRole('img', {
      name: 'Five-period sample trend for Financial Health Score, Credit Health, and Wealth Building Score',
    })
    const trendPanel = screen.getByRole('heading', { name: 'Monthly Financial Health Trend' }).closest('article')
    expect(trendPanel).toBeTruthy()
    expect(within(trendPanel as HTMLElement).getByText('Sample data')).toBeTruthy()
    expect(trendGraph.querySelectorAll('[data-trend-series]')).toHaveLength(3)
    expect(trendGraph.querySelectorAll('[data-trend-point]')).toHaveLength(15)
    expect(within(trendGraph).getAllByText(/^(Apr|May|Jun|Jul|Aug)$/)).toHaveLength(5)
    expect(within(trendGraph).getByText('Financial Health Score')).toBeTruthy()
    expect(within(trendGraph).getByText('Credit Health')).toBeTruthy()
    expect(within(trendGraph).getByText('Wealth Building Score')).toBeTruthy()
    const leafGraph = screen.getByRole('img', { name: 'Leaf graph awaiting saved lending scores' })
    expect(leafGraph.querySelectorAll('path[data-score-region]')).toHaveLength(4)
    expect(leafGraph.querySelectorAll('.financial-health-leaf-score-boundary')).toHaveLength(3)
    expect(leafGraph.querySelectorAll('linearGradient[id^="financial-health-leaf-"]')).toHaveLength(5)

    expect(screen.getByRole('progressbar', { name: 'Credit Health: 91 out of 100' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Goal Health: 82 out of 100' })).toBeTruthy()
    const creditVital = screen.getByRole('progressbar', { name: 'Credit Health: 91 out of 100' })
    fireEvent.mouseEnter(creditVital)
    expect(screen.getByRole('tooltip').textContent).toContain('Positive: 91/100')
    expect(screen.getByRole('tooltip').textContent).toContain('Your credit capacity and lending profile are strong.')
    expect(screen.getByRole('tooltip').textContent).toContain('Pay obligations on time, reduce debt balances')
    fireEvent.mouseLeave(creditVital)
    expect(screen.queryByRole('tooltip')).toBeNull()

    const protectionVital = screen.getByRole('progressbar', { name: 'Protection Health: 76 out of 100' })
    fireEvent.focus(protectionVital)
    expect(screen.getByRole('tooltip').textContent).toContain('Needs improvement: 76/100')
    expect(screen.getByRole('tooltip').textContent).toContain('Important insurance coverage gaps')
    expect(screen.getByRole('tooltip').textContent).toContain('Review life, health, disability, property')
    fireEvent.blur(protectionVital)
    const positionRings = screen.getByRole('region', { name: 'Financial Position Rings' })
    expect(within(positionRings).getByRole('progressbar', { name: 'Cash Flow Position Ring: 88 out of 100' })).toBeTruthy()
    expect(within(positionRings).getByRole('progressbar', { name: 'Credit Health Ring: 91 out of 100' })).toBeTruthy()
    expect(within(positionRings).getByRole('progressbar', { name: 'Net Worth Growth Ring: 82 out of 100' })).toBeTruthy()
    expect(within(positionRings).getByText('Progress toward your saved net-worth goal')).toBeTruthy()
    const computationSources = screen.getByRole('region', { name: 'Computation Sources' })
    expect(within(computationSources).getByText('Overall Financial Health')).toBeTruthy()
    expect(within(computationSources).getByText('Budget & Expense Tracker draft')).toBeTruthy()
    expect(within(computationSources).getByText('Index = sum(indicator score x weight) / 100; score = round(index x 10)')).toBeTruthy()
    expect(within(computationSources).getAllByRole('row')).toHaveLength(9)
    const comparisonChart = screen.getByRole('list', { name: 'Indicator score comparison' })
    const investmentRow = within(comparisonChart).getByText('Investment Health').closest('[role="listitem"]')
    expect(investmentRow).toBeTruthy()
    fireEvent.mouseEnter(investmentRow as HTMLElement)
    expect(screen.getByRole('tooltip').textContent).toContain('Investment Health: 71/100')
    expect(screen.getByRole('tooltip').textContent).toContain('Overall recommendation:')
    expect(screen.getByRole('tooltip').textContent).toContain('Automate a sustainable monthly contribution')
    fireEvent.mouseLeave(investmentRow as HTMLElement)
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.getByText('91.0', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('80.5', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('77.3', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Financial Health Summary Engine' })).toBeNull()
    expect(screen.queryByText('(91 x 15 + 88 x 14 + 94 x 14) / 43 = 91.0')).toBeNull()
    expect(screen.queryByText('Key Indicators')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Stability and Capability' })).toBeNull()
    expect(screen.queryByText('Wealth Foundation Engine')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Wealth Foundation Score' })).toBeNull()
    expect(screen.getAllByRole('progressbar')).toHaveLength(19)

    const insights = screen.getByRole('region', { name: 'Financial Health change, benchmarking, momentum, resilience, risks, and opportunities' })
    expect(within(insights).getByText('1. Financial Health Change')).toBeTruthy()
    expect(within(insights).getByText('+0')).toBeTruthy()
    expect(within(insights).getByText('No change in your financial health yet.')).toBeTruthy()
    expect(within(insights).queryByText(/PSA Household Income Classification/)).toBeNull()
    expect(within(insights).getByText('World Inequality Database Result: Bottom 60%', { selector: 'strong' })).toBeTruthy()
    expect(within(insights).getByText('Your household income is currently in the Bottom 50% in the Philippines.')).toBeTruthy()
    expect(within(insights).getByText('Add your monthly budget activity to see your financial momentum.')).toBeTruthy()
    expect(within(insights).getByText('Add your emergency fund and monthly expenses to check your resilience.')).toBeTruthy()
    expect(within(insights).getByText(/Wealth Health, Protection Health, Investment Health are below the 80-point target/)).toBeTruthy()
    expect(within(insights).getByText(/Focus on rebuilding Investment Health, Protection Health/)).toBeTruthy()
    const benchmarkTable = screen.getByRole('region', { name: '2024 Pre-Tax Income Distribution Benchmark' })
    expect(within(benchmarkTable).getAllByRole('row')).toHaveLength(8)
    expect(within(benchmarkTable).getByRole('row', { name: /5 Philippines 14.35% 45.40% 16.62% 2024 1.0/ })).toBeTruthy()
    expect(within(benchmarkTable).getByText(/Personal income or wealth percentiles require monetary threshold/)).toBeTruthy()
    expect(within(insights).getByText('3. Financial Momentum')).toBeTruthy()
    expect(within(insights).getByText('4. Financial Resilience')).toBeTruthy()
    expect(within(insights).getByText('5. Risk Alerts')).toBeTruthy()
    expect(within(insights).getByText('6. Opportunities')).toBeTruthy()
  })

  it('derives Philippine household benchmarks from Build Profile actuals', async () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-BENCHMARK',
      values: {
        citizenship: 'Filipino',
        wealthCurrency: 'PHP',
        dependents: '3',
        'wealthActual.income-salary': '120000',
        'wealthActual.asset-savings-account': '1500000',
        'wealthActual.liability-personal-loan': '250000',
      },
      documents: [],
      suitabilityAnswers: {},
      coBorrowers: [],
      guarantors: [],
      additionalCollaterals: [],
      dependents: [],
    }))

    render(<FinancialHealthSummaryPage />)

    const insights = await screen.findByRole('region', { name: 'Financial Health change, benchmarking, momentum, resilience, risks, and opportunities' })
  expect(within(insights).queryByText(/PSA Household Income Classification/)).toBeNull()
  expect(await within(insights).findByText('World Inequality Database Result: Top 20%', { selector: 'strong' })).toBeTruthy()
    expect(within(insights).getByText('Your household income is currently in the Top 10% in the Philippines.')).toBeTruthy()
    expect(within(insights).getByText(/Monthly household income ₱120,000/)).toBeTruthy()
    expect(within(insights).getByText(/Dependents 3/)).toBeTruthy()
    expect(within(insights).getByText(/Net worth ₱1,250,000/)).toBeTruthy()
  })

  it('reports investments outside the Step 11 risk appetite', async () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-CONSERVATIVE',
      values: {},
      documents: [],
      suitabilityAnswers: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`suitability-q${index + 1}`, '2'])),
      coBorrowers: [],
      guarantors: [],
      additionalCollaterals: [],
      financialInvestments: [
        { investmentType: 'Bond', issuerAsset: 'Treasury Bond', riskRating: 'Low' },
        { investmentType: 'Equity (Stock)', issuerAsset: 'Growth Equity Fund', riskRating: 'High' },
      ],
    }))

    render(<FinancialHealthSummaryPage />)

    const riskAlerts = (await screen.findByText('5. Risk Alerts')).closest('article')!
    expect(within(riskAlerts).getByText(/Growth Equity Fund is outside your Conservative risk appetite/)).toBeTruthy()
    expect(within(riskAlerts).queryByText(/Treasury Bond is outside/)).toBeNull()
  })

  it('confirms recorded investments are within the Step 11 risk appetite', async () => {
    window.localStorage.setItem('fms:build-profile', JSON.stringify({
      profileId: 'PRO-AGGRESSIVE',
      values: {},
      documents: [],
      suitabilityAnswers: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`suitability-q${index + 1}`, '4'])),
      coBorrowers: [],
      guarantors: [],
      additionalCollaterals: [],
      financialInvestments: [
        { investmentType: 'Alternative', issuerAsset: 'Private Markets Fund', riskRating: 'High' },
      ],
    }))

    render(<FinancialHealthSummaryPage />)

    const riskAlerts = (await screen.findByText('5. Risk Alerts')).closest('article')!
    expect(within(riskAlerts).getByText('All recorded investments are within your Aggressive risk appetite based on the Step 11 Suitability Assessment.')).toBeTruthy()
  })

  it('hides Calculation Transparency from non-admin users', () => {
    authorization.isAdmin = false

    render(<FinancialHealthSummaryPage />)

    expect(screen.queryByRole('region', { name: 'Computation Sources' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Financial Health' })).toBeTruthy()
  })

  it('publishes saved workflow figures only after the compute button is clicked', async () => {
    const netWorthDraft = {
      payload: {
        amounts: {
          'asset-cash-on-hand': 250000,
          'asset-savings-account': 350000,
          'asset-stocks': 250000,
          'asset-retirement-fund': 450000,
          'liability-home-mortgage': 0,
          'income-salary': 120000,
          'income-passive': 30000,
          'expense-housing': 18000,
          'expense-groceries': 9000,
          'expense-investments': 7000,
          'insurance-life': 1,
          'insurance-health': 1,
          'insurance-hmo': 1,
          'insurance-critical-illness': 1,
          'insurance-accident': 1,
          'insurance-disability': 1,
          'insurance-property': 1,
          'insurance-vehicle': 1,
          'insurance-business': 1,
        },
        selectedFinancialGoal: 'Grow an Investment Portfolio',
        targetAmount: 1000000,
        targetMonths: 12,
      },
    }
    const budgetDraft = {
      payload: {
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        incomeDraft: { salary: '100000' },
        expenseDraft: { housing: '30000', food: '15000', savings: '30000' },
        expenseAllocationDraft: {
          housing: '30',
          'food-dining': '15',
          transport: '10',
          insurance: '5',
          'savings-core': '30',
          entertainment: '10',
        },
        savedSetup: [
          { id: 'income-salary', setupAmount: 100000, type: 'income' },
          { id: 'expense-housing', setupAmount: 30000, type: 'expense' },
          { id: 'expense-food', setupAmount: 15000, type: 'expense' },
          { id: 'expense-savings', setupAmount: 30000, type: 'expense' },
        ],
        actualEntries: {
          'income-salary': '100000',
          'expense-housing': '30000',
          'expense-food': '15000',
          'expense-savings': '30000',
        },
        cashFlowHistory: Array.from({ length: 12 }, () => ({
          income: 100000,
          expenses: 75000,
          budgetVariancePercent: 2,
          budgetCompleted: true,
        })),
      },
    }
    const loanMonitoringDraft = {
      payload: {
        publishedScore: {
          score: 88,
          grade: 'B+',
          interpretation: 'Very Good',
          components: {
            paymentPerformance: 28,
            balanceManagement: 12,
            debtServiceCapacity: 17,
            loanUtilization: 8,
            collateralQuality: 10,
            portfolioHealth: 9,
            aiAdjustment: 4,
          },
        },
      },
    }
    fetchAutosaveDraft.mockImplementation((scope: string) => Promise.resolve(
      scope === 'budget-expense-tracker'
        ? budgetDraft
        : scope === 'loan-monitoring'
          ? loanMonitoringDraft
          : netWorthDraft,
    ))

    render(<FinancialHealthSummaryPage />)

    expect(await screen.findByText('Saved inputs are ready for review.')).toBeTruthy()
    expect(screen.getByText('842', { selector: '.financial-health-ring-score strong' })).toBeTruthy()
    expect(screen.getByText('91.0', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Compute Latest Financial Health' }))

    expect(await screen.findByText('962', { selector: '.financial-health-ring-score strong' })).toBeTruthy()
    expect(screen.getByText('96.9', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('98.2', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByText('92.7', { selector: '.financial-health-summary-tile strong' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Cash Flow Position Ring: 100 out of 100' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Net Worth Growth Ring: 100 out of 100' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Financial Health Summary Engine' })).toBeNull()
    expect(screen.queryByText('Wealth Foundation Engine')).toBeNull()

    const insights = screen.getByRole('region', { name: 'Financial Health change, benchmarking, momentum, resilience, risks, and opportunities' })
    expect(within(insights).getByText('+120')).toBeTruthy()
    expect(within(insights).getByText(/Your financial health improved. The biggest gains came from/)).toBeTruthy()
    expect(within(insights).getByText('Improving')).toBeTruthy()
    expect(within(insights).getByText('Improving for the last 12 months. Keep it up.')).toBeTruthy()
    expect(within(insights).getByText('17.6 months')).toBeTruthy()
    expect(within(insights).getByText('Your emergency fund can cover 17.6 months of expenses. You are in a resilient position.')).toBeTruthy()
  })
})

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAutosaveDraft } from '../../autosave';
import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildBudgetExpenseTrackerSnapshot } from './liveTrackerMetrics';

type WorkflowStep = 1 | 2 | 3;
type IncomeKey = 'salary' | 'business' | 'investment' | 'pension';

interface WorkflowLineItem {
  id: string;
  label: string;
  setupAmount: number;
  type: 'income' | 'expense';
}

interface BudgetExpenseTrackerDraft {
  step: WorkflowStep;
  periodStart: string;
  periodEnd: string;
  incomeDraft: Record<IncomeKey, string>;
  expenseDraft: Record<string, string>;
  savedSetup: WorkflowLineItem[];
  actualEntries: Record<string, string>;
  varianceNotes: Record<string, string>;
}

const DEFAULT_BUDGET_EXPENSE_TRACKER_DRAFT: BudgetExpenseTrackerDraft = {
  step: 1,
  periodStart: '',
  periodEnd: '',
  incomeDraft: {
    salary: '',
    business: '',
    investment: '',
    pension: '',
  },
  expenseDraft: {},
  savedSetup: [],
  actualEntries: {},
  varianceNotes: {},
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSignedCurrency(amount: number) {
  const absoluteAmount = formatCurrency(Math.abs(amount));
  if (amount > 0) {
    return `+${absoluteAmount}`;
  }
  if (amount < 0) {
    return `-${absoluteAmount}`;
  }
  return absoluteAmount;
}

function toInputAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  return Math.round(value).toString();
}

function toSafeNumber(rawValue: string) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function isBlank(rawValue: string | undefined) {
  return (rawValue ?? '').trim() === '';
}

function buildVarianceExplanation(itemType: 'income' | 'expense', variance: number) {
  if (variance === 0) {
    return 'On target versus setup';
  }

  if (itemType === 'income') {
    return variance > 0
      ? 'Higher realized income than setup'
      : 'Lower realized income than setup';
  }

  return variance > 0
    ? 'Spending is above setup and needs attention'
    : 'Spending is below setup and can improve savings';
}

export default function BudgetExpenseTrackerPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const snapshot = useMemo(
    () => buildBudgetExpenseTrackerSnapshot(applications),
    [applications],
  );
  const [step, setStep] = useState<WorkflowStep>(1);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [incomeDraft, setIncomeDraft] = useState<Record<IncomeKey, string>>({
    salary: '',
    business: '',
    investment: '',
    pension: '',
  });
  const [expenseDraft, setExpenseDraft] = useState<Record<string, string>>({});
  const [savedSetup, setSavedSetup] = useState<WorkflowLineItem[]>([]);
  const [actualEntries, setActualEntries] = useState<Record<string, string>>({});
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({});
  const [setupStatusMessage, setSetupStatusMessage] = useState('');
  const sourceSnapshotAppliedRef = useRef(false);

  const autosaveValue = useMemo<BudgetExpenseTrackerDraft>(() => ({
    step,
    periodStart,
    periodEnd,
    incomeDraft,
    expenseDraft,
    savedSetup,
    actualEntries,
    varianceNotes,
  }), [
    actualEntries,
    expenseDraft,
    incomeDraft,
    periodEnd,
    periodStart,
    savedSetup,
    step,
    varianceNotes,
  ]);

  const handleAutosaveHydrate = useCallback((draft: BudgetExpenseTrackerDraft) => {
    setStep(draft.step);
    setPeriodStart(draft.periodStart);
    setPeriodEnd(draft.periodEnd);
    setIncomeDraft(draft.incomeDraft);
    setExpenseDraft(draft.expenseDraft);
    setSavedSetup(draft.savedSetup);
    setActualEntries(draft.actualEntries);
    setVarianceNotes(draft.varianceNotes);
  }, []);

  const { isHydrated } = useAutosaveDraft({
    scope: 'budget-expense-tracker',
    entityKey: 'primary',
    value: autosaveValue,
    defaults: DEFAULT_BUDGET_EXPENSE_TRACKER_DRAFT,
    onHydrate: handleAutosaveHydrate,
  });

  useEffect(() => {
    if (!isHydrated || loading || sourceSnapshotAppliedRef.current) {
      return;
    }

    sourceSnapshotAppliedRef.current = true;
    const hasRestoredWorkflow = step !== 1
      || periodStart !== ''
      || periodEnd !== ''
      || Object.values(incomeDraft).some((value) => value !== '')
      || Object.values(expenseDraft).some((value) => value !== '')
      || savedSetup.length > 0
      || Object.values(actualEntries).some((value) => value !== '')
      || Object.values(varianceNotes).some((value) => value !== '');

    if (hasRestoredWorkflow) {
      return;
    }

    const findIncomeValue = (keywords: string[]) => {
      const matched = snapshot.incomeItems.find((item) => {
        const text = `${item.id} ${item.label}`.toLowerCase();
        return keywords.some((keyword) => text.includes(keyword));
      });
      return matched?.amount ?? 0;
    };

    setIncomeDraft({
      salary: toInputAmount(findIncomeValue(['salary', 'gross monthly', 'employment'])),
      business: toInputAmount(findIncomeValue(['business'])),
      investment: toInputAmount(findIncomeValue(['investment'])),
      pension: toInputAmount(findIncomeValue(['pension'])),
    });

    setExpenseDraft(
      snapshot.categoryItems.reduce<Record<string, string>>((accumulator, item) => {
        accumulator[item.id] = toInputAmount(item.amount);
        return accumulator;
      }, {}),
    );
  }, [
    actualEntries,
    expenseDraft,
    incomeDraft,
    isHydrated,
    loading,
    periodEnd,
    periodStart,
    savedSetup,
    snapshot.categoryItems,
    snapshot.incomeItems,
    step,
    varianceNotes,
  ]);

  const workflowSteps: Array<{ id: WorkflowStep; label: string; description: string }> = [
    {
      id: 1,
      label: 'Choose Period Covered',
      description: 'Select covered dates for this workflow.',
    },
    {
      id: 2,
      label: 'Set Up Baseline',
      description: 'Enter setup values before saving.',
    },
    {
      id: 3,
      label: 'Actual vs Setup Variance',
      description: 'Enter actual values and review variance.',
    },
  ];

  const currentStepLabel = workflowSteps.find((item) => item.id === step)?.label ?? 'Budget Workflow';
  const completionPercent = Math.round((step / workflowSteps.length) * 100);

  const budgetSetupTotals = useMemo(() => {
    const incomeTotal = toSafeNumber(incomeDraft.salary)
      + toSafeNumber(incomeDraft.business)
      + toSafeNumber(incomeDraft.investment)
      + toSafeNumber(incomeDraft.pension);

    const expenseTotal = snapshot.categoryItems.reduce((total, item) => {
      return total + toSafeNumber(expenseDraft[item.id] ?? '');
    }, 0);

    return {
      incomeTotal,
      expenseTotal,
      net: incomeTotal - expenseTotal,
    };
  }, [incomeDraft, expenseDraft, snapshot.categoryItems]);

  const handleSaveSetup = () => {
    if (!periodStart || !periodEnd) {
      setSetupStatusMessage('Please complete the period covered before saving the budget setup.');
      setStep(1);
      return;
    }

    const setupLines: WorkflowLineItem[] = [
      {
        id: 'income-salary',
        label: 'Income from Salary',
        setupAmount: toSafeNumber(incomeDraft.salary),
        type: 'income',
      },
      {
        id: 'income-business',
        label: 'Income from Business',
        setupAmount: toSafeNumber(incomeDraft.business),
        type: 'income',
      },
      {
        id: 'income-investment',
        label: 'Income from Investment',
        setupAmount: toSafeNumber(incomeDraft.investment),
        type: 'income',
      },
      {
        id: 'income-pension',
        label: 'Income from Pension',
        setupAmount: toSafeNumber(incomeDraft.pension),
        type: 'income',
      },
      ...snapshot.categoryItems.map((item) => ({
        id: `expense-${item.id}`,
        label: `Expense - ${item.label}`,
        setupAmount: toSafeNumber(expenseDraft[item.id] ?? ''),
        type: 'expense' as const,
      })),
    ];

    setSavedSetup(setupLines);
    setActualEntries({});
    setVarianceNotes({});
    setSetupStatusMessage('Setup saved. Continue with Step 3 to enter actual values and monitor variance.');
    setStep(3);
  };

  const varianceRows = useMemo(() => {
    return savedSetup.map((item) => {
      const rawActual = actualEntries[item.id] ?? '';
      const hasActual = !isBlank(rawActual);
      const actualAmount = hasActual ? toSafeNumber(rawActual) : 0;
      const variance = hasActual ? actualAmount - item.setupAmount : 0;

      return {
        ...item,
        hasActual,
        actualAmount,
        variance,
      };
    });
  }, [savedSetup, actualEntries]);

  const setupVsActualSummary = useMemo(() => {
    const setupIncomeTotal = varianceRows
      .filter((item) => item.type === 'income')
      .reduce((total, item) => total + item.setupAmount, 0);
    const setupExpenseTotal = varianceRows
      .filter((item) => item.type === 'expense')
      .reduce((total, item) => total + item.setupAmount, 0);
    const actualIncomeTotal = varianceRows
      .filter((item) => item.type === 'income' && item.hasActual)
      .reduce((total, item) => total + item.actualAmount, 0);
    const actualExpenseTotal = varianceRows
      .filter((item) => item.type === 'expense' && item.hasActual)
      .reduce((total, item) => total + item.actualAmount, 0);

    return {
      setupIncomeTotal,
      setupExpenseTotal,
      setupNet: setupIncomeTotal - setupExpenseTotal,
      actualIncomeTotal,
      actualExpenseTotal,
      actualNet: actualIncomeTotal - actualExpenseTotal,
    };
  }, [varianceRows]);

  const topVarianceRows = useMemo(() => {
    return varianceRows
      .filter((item) => item.hasActual)
      .map((item) => ({
        ...item,
        magnitude: Math.abs(item.variance),
      }))
      .sort((left, right) => right.magnitude - left.magnitude)
      .slice(0, 5);
  }, [varianceRows]);

  const maxVarianceMagnitude = useMemo(() => {
    return topVarianceRows.reduce((largest, item) => Math.max(largest, item.magnitude), 0);
  }, [topVarianceRows]);

  const aiRecommendations = useMemo(() => {
    if (varianceRows.length === 0) {
      return [
        'Save your setup to generate tailored recommendations for this budget period.',
      ];
    }

    const hasAnyActual = varianceRows.some((item) => item.hasActual);
    if (!hasAnyActual) {
      return [
        'Start entering actual values in Step 3. AI recommendations will update as soon as variances are available.',
      ];
    }

    const priorityRows = varianceRows
      .filter((item) => item.hasActual)
      .map((item) => {
        const riskMagnitude = item.type === 'expense'
          ? Math.max(item.variance, 0)
          : Math.max(-item.variance, 0);
        return {
          ...item,
          riskMagnitude,
        };
      })
      .sort((left, right) => right.riskMagnitude - left.riskMagnitude)
      .slice(0, 3)
      .filter((item) => item.riskMagnitude > 0);

    const recommendations = priorityRows.map((item) => {
      if (item.type === 'expense') {
        return `${item.label} is above setup by ${formatCurrency(item.variance)}. Consider setting a weekly spend cap and moving this category to watchlist.`;
      }
      return `${item.label} is below setup by ${formatCurrency(Math.abs(item.variance))}. Review expected inflow timing and prepare contingency cashflow.`;
    });

    if (recommendations.length === 0) {
      recommendations.push('Actuals are within setup targets. Continue tracking and keep variance explanations updated for audit readiness.');
    }

    recommendations.push(
      `Projected net cashflow is ${formatSignedCurrency(setupVsActualSummary.actualNet || setupVsActualSummary.setupNet)}. Keep at least one month of fixed obligations in reserve.`,
    );

    return recommendations.slice(0, 4);
  }, [varianceRows, setupVsActualSummary.actualNet, setupVsActualSummary.setupNet]);

  return (
    <div className="psychometric-page budget-dashboard-page">
      <section className="psychometric-hero budget-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Budget Workflow Controls</span>
          <h1>Budget and Expense Tracker</h1>
          <p>
            Period: <strong>{snapshot.periodLabel}</strong> | Date: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Navigate a guided workflow to set period coverage, build the budget setup, then monitor actual
            versus setup variances with AI guidance.
          </p>
        </div>

        <div className="psychometric-hero-metric budget-dashboard-scorecard">
          <span>Budget Health Score</span>
          <strong>{snapshot.healthScore.toFixed(1)}</strong>
          <small>{`Step ${step}/${workflowSteps.length}: ${currentStepLabel}`}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid budget-dashboard-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Progress</span>
          <strong>{completionPercent}%</strong>
          <small>{currentStepLabel}</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Planned Income</span>
          <strong>{formatCurrency(budgetSetupTotals.incomeTotal)}</strong>
          <small>Salary, business, investment, pension</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Planned Expenses</span>
          <strong>{formatCurrency(budgetSetupTotals.expenseTotal)}</strong>
          <small>All itemized expense categories</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Planned Net</span>
          <strong>{formatSignedCurrency(budgetSetupTotals.net)}</strong>
          <small>{snapshot.performanceBand}</small>
        </article>
      </section>

      <section className="budget-dashboard-layout">
        <div className="budget-dashboard-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Workflow Form</span>
                <h2>{`Step ${step}: ${currentStepLabel}`}</h2>
              </div>
              <button
                type="button"
                className="psychometric-reset-button"
                onClick={reload}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>

            {error ? (
              <p className="psychometric-section-note" role="alert">
                {error}
              </p>
            ) : null}

            <p className="psychometric-section-note">
              {snapshot.sourceLabel} | {snapshot.sourceApplicationNo}
              {lastUpdated ? ` | Updated ${lastUpdated.toLocaleString()}` : ''}
            </p>

            {setupStatusMessage ? (
              <div className="budget-workflow-status-banner" role="status">
                {setupStatusMessage}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="budget-workflow-step-block">
                <h3>Step 1: Choose Period Covered</h3>
                <p className="psychometric-section-note">
                  Select the coverage period for this budget workflow. This period will be tied to your saved setup.
                </p>
                <div className="budget-workflow-grid-two">
                  <label>
                    Period Start
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(event) => setPeriodStart(event.target.value)}
                    />
                  </label>
                  <label>
                    Period End
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(event) => setPeriodEnd(event.target.value)}
                    />
                  </label>
                </div>
                <div className="budget-workflow-inline-actions">
                  <button type="button" className="psychometric-reset-button" onClick={() => setStep(2)}>
                    Continue to Step 2
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="budget-workflow-step-block">
                <h3>Step 2: Set Up Baseline</h3>
                <p className="psychometric-section-note">
                  Enter your monthly income setup and itemized expenses, then click save to publish this setup to Step 3.
                </p>

                <div className="budget-dashboard-category-summary">
                  <div className="budget-dashboard-category-summary-card">
                    <span>Setup Income</span>
                    <strong>{formatCurrency(budgetSetupTotals.incomeTotal)}</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Setup Expenses</span>
                    <strong>{formatCurrency(budgetSetupTotals.expenseTotal)}</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Setup Net</span>
                    <strong>{formatSignedCurrency(budgetSetupTotals.net)}</strong>
                  </div>
                </div>

                <div className="budget-workflow-income-grid">
                  <label>
                    Income from Salary
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={incomeDraft.salary}
                      onChange={(event) => {
                        setIncomeDraft((previous) => ({
                          ...previous,
                          salary: event.target.value,
                        }));
                      }}
                    />
                  </label>
                  <label>
                    Income from Business
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={incomeDraft.business}
                      onChange={(event) => {
                        setIncomeDraft((previous) => ({
                          ...previous,
                          business: event.target.value,
                        }));
                      }}
                    />
                  </label>
                  <label>
                    Income from Investment
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={incomeDraft.investment}
                      onChange={(event) => {
                        setIncomeDraft((previous) => ({
                          ...previous,
                          investment: event.target.value,
                        }));
                      }}
                    />
                  </label>
                  <label>
                    Income from Pension
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={incomeDraft.pension}
                      onChange={(event) => {
                        setIncomeDraft((previous) => ({
                          ...previous,
                          pension: event.target.value,
                        }));
                      }}
                    />
                  </label>
                </div>

                <h4 className="budget-workflow-subtitle">Itemized Expense Setup</h4>
                <div className="budget-dashboard-category-grid">
                  {snapshot.categoryItems.map((item) => (
                    <article key={item.id} className="budget-dashboard-card">
                      <div className="budget-dashboard-card-header">
                        <span>{item.label}</span>
                        <strong>{item.share.toFixed(0)}%</strong>
                      </div>
                      <label className="budget-dashboard-category-input-wrap">
                        <span className="budget-dashboard-category-input-label">Setup Amount</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={expenseDraft[item.id] ?? ''}
                          onChange={(event) => {
                            setExpenseDraft((previous) => ({
                              ...previous,
                              [item.id]: event.target.value,
                            }));
                          }}
                          className="budget-dashboard-category-input"
                          aria-label={`${item.label} setup amount`}
                        />
                      </label>
                      <small className="budget-dashboard-category-helper">
                        Suggested baseline: {formatCurrency(item.amount)}
                      </small>
                    </article>
                  ))}
                </div>

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="budget-dashboard-category-reset" onClick={() => setStep(1)}>
                    Back to Step 1
                  </button>
                  <button type="button" className="psychometric-reset-button" onClick={handleSaveSetup}>
                    Save Setup and Continue to Step 3
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="budget-workflow-step-block">
                <h3>Step 3: Actual vs Setup Variance</h3>
                <p className="psychometric-section-note">
                  First column shows the saved setup. Second column is intentionally blank for user actuals. Third column shows variance and fourth column provides small-text variance explanation.
                </p>

                {savedSetup.length === 0 ? (
                  <p className="psychometric-section-note">
                    No saved setup yet. Complete Step 2 and click save setup first.
                  </p>
                ) : (
                  <div className="psychometric-scale-table-wrap">
                    <table className="psychometric-scale-table">
                      <thead>
                        <tr>
                          <th>Budget Setup</th>
                          <th>Actual (User Input)</th>
                          <th>Variance</th>
                          <th>Variance Explanation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {varianceRows.map((item) => (
                          <tr key={item.id}>
                            <td data-label="Budget Setup">
                              <strong>{item.label}</strong>
                              <div>{formatCurrency(item.setupAmount)}</div>
                            </td>
                            <td data-label="Actual (User Input)">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={actualEntries[item.id] ?? ''}
                                onChange={(event) => {
                                  setActualEntries((previous) => ({
                                    ...previous,
                                    [item.id]: event.target.value,
                                  }));
                                }}
                                placeholder="Enter actual amount"
                                aria-label={`${item.label} actual amount`}
                              />
                            </td>
                            <td data-label="Variance">
                              {item.hasActual ? formatSignedCurrency(item.variance) : 'Pending input'}
                            </td>
                            <td data-label="Variance Explanation">
                              <small className="budget-workflow-variance-copy">
                                {item.hasActual
                                  ? (varianceNotes[item.id]?.trim() || buildVarianceExplanation(item.type, item.variance))
                                  : 'Awaiting actual value from user.'}
                              </small>
                              {item.hasActual ? (
                                <input
                                  type="text"
                                  value={varianceNotes[item.id] ?? ''}
                                  onChange={(event) => {
                                    setVarianceNotes((previous) => ({
                                      ...previous,
                                      [item.id]: event.target.value,
                                    }));
                                  }}
                                  placeholder="Optional explanation"
                                  aria-label={`${item.label} variance explanation`}
                                />
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="budget-workflow-inline-actions">
                  <button type="button" className="budget-dashboard-category-reset" onClick={() => setStep(2)}>
                    Back to Step 2
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          {step === 3 ? (
            <article className="psychometric-panel">
              <div className="psychometric-panel-header">
                <div>
                  <span className="psychometric-panel-kicker">AI Recommendations</span>
                  <h2>Variance coaching and trend visuals</h2>
                </div>
              </div>

              <div className="budget-workflow-ai-grid">
                <article className="budget-workflow-ai-card">
                  <h3>Recommendations</h3>
                  <ul className="psychometric-breakdown-list">
                    {aiRecommendations.map((recommendation) => (
                      <li key={recommendation}>
                        <span>{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="budget-workflow-ai-card">
                  <h3>Income vs Expense Graph</h3>
                  <div className="budget-workflow-graph-row">
                    <span>Setup Income</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className="budget-workflow-graph-bar budget-workflow-graph-bar-setup"
                        style={{
                          width: `${Math.min(
                            100,
                            setupVsActualSummary.setupIncomeTotal > 0
                              ? (setupVsActualSummary.setupIncomeTotal / Math.max(setupVsActualSummary.setupIncomeTotal, setupVsActualSummary.actualIncomeTotal, 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCurrency(setupVsActualSummary.setupIncomeTotal)}</strong>
                  </div>
                  <div className="budget-workflow-graph-row">
                    <span>Actual Income</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className="budget-workflow-graph-bar budget-workflow-graph-bar-actual"
                        style={{
                          width: `${Math.min(
                            100,
                            setupVsActualSummary.actualIncomeTotal > 0
                              ? (setupVsActualSummary.actualIncomeTotal / Math.max(setupVsActualSummary.setupIncomeTotal, setupVsActualSummary.actualIncomeTotal, 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCurrency(setupVsActualSummary.actualIncomeTotal)}</strong>
                  </div>
                  <div className="budget-workflow-graph-row">
                    <span>Setup Expenses</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className="budget-workflow-graph-bar budget-workflow-graph-bar-alert"
                        style={{
                          width: `${Math.min(
                            100,
                            setupVsActualSummary.setupExpenseTotal > 0
                              ? (setupVsActualSummary.setupExpenseTotal / Math.max(setupVsActualSummary.setupExpenseTotal, setupVsActualSummary.actualExpenseTotal, 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCurrency(setupVsActualSummary.setupExpenseTotal)}</strong>
                  </div>
                  <div className="budget-workflow-graph-row">
                    <span>Actual Expenses</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className="budget-workflow-graph-bar budget-workflow-graph-bar-warning"
                        style={{
                          width: `${Math.min(
                            100,
                            setupVsActualSummary.actualExpenseTotal > 0
                              ? (setupVsActualSummary.actualExpenseTotal / Math.max(setupVsActualSummary.setupExpenseTotal, setupVsActualSummary.actualExpenseTotal, 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCurrency(setupVsActualSummary.actualExpenseTotal)}</strong>
                  </div>
                </article>

                <article className="budget-workflow-ai-card">
                  <h3>Top Variance Graph</h3>
                  {topVarianceRows.length === 0 ? (
                    <p className="psychometric-section-note">Enter actual values to visualize top variances.</p>
                  ) : (
                    <div className="budget-workflow-variance-chart">
                      {topVarianceRows.map((item) => (
                        <div key={item.id} className="budget-workflow-variance-row">
                          <span>{item.label}</span>
                          <div className="budget-workflow-graph-track">
                            <div
                              className={`budget-workflow-graph-bar ${item.variance >= 0 ? 'budget-workflow-graph-bar-warning' : 'budget-workflow-graph-bar-setup'}`}
                              style={{
                                width: `${maxVarianceMagnitude > 0 ? (item.magnitude / maxVarianceMagnitude) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <strong>{formatSignedCurrency(item.variance)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </div>
            </article>
          ) : null}
        </div>

        <aside className="budget-dashboard-side">
          <article className="psychometric-panel psychometric-sticky-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Workflow Steps</span>
                <h2>Navigate Workflow Steps</h2>
              </div>
            </div>
            <div className="budget-workflow-step-list">
              {workflowSteps.map((workflowStep) => {
                const isActive = step === workflowStep.id;
                const isCompleted = step > workflowStep.id;
                const statusLabel = isActive ? 'Current step' : isCompleted ? 'Completed' : 'Pending';

                return (
                  <button
                    key={workflowStep.id}
                    type="button"
                    onClick={() => setStep(workflowStep.id)}
                    className={`loan-stepper-button budget-workflow-step-button ${isActive ? 'loan-stepper-button-active' : 'loan-stepper-button-idle'}`}
                  >
                    <div className={`budget-workflow-step-index ${isActive || isCompleted ? 'budget-workflow-step-index-active' : ''}`}>
                      {workflowStep.id}
                    </div>
                    <div className="budget-workflow-step-copy">
                      <strong>{workflowStep.label}</strong>
                      <span>{statusLabel}</span>
                      <small>{workflowStep.description}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Setup Snapshot</span>
            <h2>{savedSetup.length > 0 ? 'Saved Setup' : 'Draft Setup'}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Period Covered</span>
                <strong>{periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Not set'}</strong>
              </li>
              <li>
                <span>Income Setup</span>
                <strong>{formatCurrency(budgetSetupTotals.incomeTotal)}</strong>
              </li>
              <li>
                <span>Expense Setup</span>
                <strong>{formatCurrency(budgetSetupTotals.expenseTotal)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Variance Control</span>
            <h2>{savedSetup.length > 0 ? 'Ready for Tracking' : 'Waiting for Save Setup'}</h2>
            <p className="psychometric-section-note">
              Enter actual values in Step 3 to activate variance analytics, explanation notes, AI recommendations,
              and graphs.
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}

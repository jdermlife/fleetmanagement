import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAutosaveDraft } from '../../autosave';
import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildBudgetExpenseTrackerSnapshot } from './liveTrackerMetrics';

type WorkflowStep = 1 | 2 | 3;
type IncomeKey = 'salary' | 'business' | 'investment' | 'pension';

const HOUSE_AMORTIZATION_KEY = 'expense-house-amortization';
const LOAN_AMORTIZATION_KEY = 'expense-loan-amortization';

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
  expenseAllocationDraft: Record<string, string>;
  savedSetup: WorkflowLineItem[];
  actualEntries: Record<string, string>;
  varianceNotes: Record<string, string>;
  actionsToBeTaken: string;
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
  expenseAllocationDraft: {},
  savedSetup: [],
  actualEntries: {},
  varianceNotes: {},
  actionsToBeTaken: '',
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

function formatPercentInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  return value.toFixed(2).replace(/\.00$/, '');
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
  const [expenseAllocationDraft, setExpenseAllocationDraft] = useState<Record<string, string>>({});
  const [savedSetup, setSavedSetup] = useState<WorkflowLineItem[]>([]);
  const [actualEntries, setActualEntries] = useState<Record<string, string>>({});
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({});
  const [actionsToBeTaken, setActionsToBeTaken] = useState('');
  const [setupStatusMessage, setSetupStatusMessage] = useState('');
  const sourceSnapshotAppliedRef = useRef(false);

  const autosaveValue = useMemo<BudgetExpenseTrackerDraft>(() => ({
    step,
    periodStart,
    periodEnd,
    incomeDraft,
    expenseDraft,
    expenseAllocationDraft,
    savedSetup,
    actualEntries,
    varianceNotes,
    actionsToBeTaken,
  }), [
    actualEntries,
    actionsToBeTaken,
    expenseAllocationDraft,
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
    setExpenseAllocationDraft(draft.expenseAllocationDraft ?? {});
    setSavedSetup(draft.savedSetup);
    setActualEntries(draft.actualEntries);
    setVarianceNotes(draft.varianceNotes);
    setActionsToBeTaken(draft.actionsToBeTaken ?? '');
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
      || Object.values(expenseAllocationDraft).some((value) => value !== '')
      || savedSetup.length > 0
      || Object.values(actualEntries).some((value) => value !== '')
      || Object.values(varianceNotes).some((value) => value !== '')
      || actionsToBeTaken !== '';

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

    setExpenseAllocationDraft(
      snapshot.categoryItems.reduce<Record<string, string>>((accumulator, item) => {
        accumulator[item.id] = formatPercentInput(item.share);
        return accumulator;
      }, {}),
    );
  }, [
    actualEntries,
    expenseAllocationDraft,
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
    actionsToBeTaken,
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

  const stepCompletionById = useMemo<Record<WorkflowStep, number>>(() => {
    const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

    const periodFieldsCompleted = [periodStart, periodEnd].filter((value) => !isBlank(value)).length;
    const step1Percent = clamp((periodFieldsCompleted / 2) * 100);

    const incomeProvided = Object.values(incomeDraft).some((value) => !isBlank(value));
    const hasCategoryExpense = snapshot.categoryItems.some((item) => !isBlank(expenseDraft[item.id]));
    const hasFixedAmortizationExpense = !isBlank(expenseDraft[HOUSE_AMORTIZATION_KEY]) || !isBlank(expenseDraft[LOAN_AMORTIZATION_KEY]);
    const expenseProvided = hasCategoryExpense || hasFixedAmortizationExpense;
    const allocationProvided = snapshot.categoryItems.some((item) => !isBlank(expenseAllocationDraft[item.id]));
    const allocationTotal = snapshot.categoryItems.reduce((total, item) => {
      return total + toSafeNumber(expenseAllocationDraft[item.id] ?? '');
    }, 0);
    const allocationBalanced = allocationProvided && Math.abs(100 - allocationTotal) < 0.01;
    const setupSaved = savedSetup.length > 0;
    const step2Checks = [incomeProvided, expenseProvided, allocationProvided, allocationBalanced, setupSaved].filter(Boolean).length;
    const step2Percent = setupSaved ? 100 : clamp((step2Checks / 5) * 100);

    const setupCount = savedSetup.length;
    const actualCompleted = setupCount > 0
      ? savedSetup.filter((line) => !isBlank(actualEntries[line.id])).length / setupCount
      : 0;
    const notesCompleted = setupCount > 0
      ? savedSetup.filter((line) => !isBlank(varianceNotes[line.id])).length / setupCount
      : 0;
    const hasActions = !isBlank(actionsToBeTaken);
    const step3Percent = setupCount === 0
      ? 0
      : clamp(((actualCompleted * 0.7) + (notesCompleted * 0.2) + (hasActions ? 0.1 : 0)) * 100);

    return {
      1: step1Percent,
      2: step2Percent,
      3: step3Percent,
    };
  }, [
    actionsToBeTaken,
    actualEntries,
    expenseAllocationDraft,
    expenseDraft,
    incomeDraft,
    periodEnd,
    periodStart,
    savedSetup,
    snapshot.categoryItems,
    varianceNotes,
  ]);

  const budgetSetupTotals = useMemo(() => {
    const incomeTotal = toSafeNumber(incomeDraft.salary)
      + toSafeNumber(incomeDraft.business)
      + toSafeNumber(incomeDraft.investment)
      + toSafeNumber(incomeDraft.pension);

    const expenseTotal = snapshot.categoryItems.reduce((total, item) => {
      return total + toSafeNumber(expenseDraft[item.id] ?? '');
    }, 0)
      + toSafeNumber(expenseDraft[HOUSE_AMORTIZATION_KEY] ?? '')
      + toSafeNumber(expenseDraft[LOAN_AMORTIZATION_KEY] ?? '');

    return {
      incomeTotal,
      expenseTotal,
      net: incomeTotal - expenseTotal,
    };
  }, [incomeDraft, expenseDraft, snapshot.categoryItems]);

  const budgetAiSummary = useMemo(() => {
    const net = budgetSetupTotals.net;
    const fixedObligationsTotal = toSafeNumber(expenseDraft[HOUSE_AMORTIZATION_KEY] ?? '')
      + toSafeNumber(expenseDraft[LOAN_AMORTIZATION_KEY] ?? '');
    const fixedObligationsCopy = fixedObligationsTotal > 0
      ? ` Fixed obligations (House + Loan Amortization): ${formatCurrency(fixedObligationsTotal)}.`
      : ' Fixed obligations (House + Loan Amortization) are not set yet.';

    if (net > 0) {
      return {
        status: 'surplus' as const,
        headline: 'Income exceeds expenses',
        recommendation: `AI recommendation: Move ${formatCurrency(net)} to savings while prioritizing fixed obligations coverage.${fixedObligationsCopy}`,
        detail: `The current setup produces a positive monthly surplus, so the excess should be retained as savings after fixed obligations are protected.${fixedObligationsCopy}`,
      };
    }

    if (net < 0) {
      return {
        status: 'deficit' as const,
        headline: 'Expenses exceed income',
        recommendation: `AI recommendation: Reduce savings by ${formatCurrency(Math.abs(net))} or cut expenses to restore balance, starting with non-fixed categories.${fixedObligationsCopy}`,
        detail: `The current setup is running at a deficit, so savings would need to absorb the shortfall unless expenses are reduced or income increases. Protect fixed obligations first.${fixedObligationsCopy}`,
      };
    }

    return {
      status: 'balanced' as const,
      headline: 'Income matches expenses',
      recommendation: `AI recommendation: No additional savings movement is required based on the current setup.${fixedObligationsCopy}`,
      detail: `The budget is exactly balanced, so there is no surplus to save and no deficit to fund from savings.${fixedObligationsCopy}`,
    };
  }, [budgetSetupTotals.net, expenseDraft]);

  const allocationSummary = useMemo(() => {
    const totalAllocation = snapshot.categoryItems.reduce((total, item) => {
      return total + toSafeNumber(expenseAllocationDraft[item.id] ?? '');
    }, 0);

    const varianceToTarget = Number((100 - totalAllocation).toFixed(2));

    return {
      totalAllocation: Number(totalAllocation.toFixed(2)),
      varianceToTarget,
      isBalanced: Math.abs(varianceToTarget) < 0.01,
    };
  }, [expenseAllocationDraft, snapshot.categoryItems]);

  const handleNormalizeExpenseAllocation = () => {
    const currentTotal = snapshot.categoryItems.reduce((total, item) => {
      return total + toSafeNumber(expenseAllocationDraft[item.id] ?? '');
    }, 0);

    if (currentTotal <= 0) {
      setSetupStatusMessage('Enter expense allocation percentages first before normalizing to 100%.');
      return;
    }

    let runningTotal = 0;
    const normalizedDraft = snapshot.categoryItems.reduce<Record<string, string>>((accumulator, item, index) => {
      if (index === snapshot.categoryItems.length - 1) {
        accumulator[item.id] = formatPercentInput(Math.max(0, 100 - runningTotal));
        return accumulator;
      }

      const nextValue = Number(((toSafeNumber(expenseAllocationDraft[item.id] ?? '') / currentTotal) * 100).toFixed(2));
      runningTotal += nextValue;
      accumulator[item.id] = formatPercentInput(nextValue);
      return accumulator;
    }, {});

    setExpenseAllocationDraft(normalizedDraft);
    setSetupStatusMessage('Expense allocation percentages were normalized to 100%.');
  };

  const handleApplyExpenseAllocation = () => {
    if (!allocationSummary.isBalanced) {
      setSetupStatusMessage(
        `Expense allocation must total 100%. Current variance is ${allocationSummary.varianceToTarget.toFixed(2)}%.`,
      );
      return;
    }

    const currentExpenseBudget = snapshot.categoryItems.reduce((total, item) => {
      return total + toSafeNumber(expenseDraft[item.id] ?? '');
    }, 0);
    const baselineExpenseBudget = currentExpenseBudget > 0
      ? currentExpenseBudget
      : snapshot.categoryItems.reduce((total, item) => total + item.amount, 0);

    if (baselineExpenseBudget <= 0) {
      setSetupStatusMessage('Provide setup expense amounts first so revised allocation percentages can be applied.');
      return;
    }

    let allocatedTotal = 0;
    const nextExpenseDraft = snapshot.categoryItems.reduce<Record<string, string>>((accumulator, item, index) => {
      if (index === snapshot.categoryItems.length - 1) {
        accumulator[item.id] = (baselineExpenseBudget - allocatedTotal).toFixed(2);
        return accumulator;
      }

      const nextAmount = Number(((baselineExpenseBudget * toSafeNumber(expenseAllocationDraft[item.id] ?? '')) / 100).toFixed(2));
      allocatedTotal += nextAmount;
      accumulator[item.id] = nextAmount.toFixed(2);
      return accumulator;
    }, {});

    setExpenseDraft((previous) => ({
      ...previous,
      ...nextExpenseDraft,
    }));
    setSetupStatusMessage('Expense setup amounts were recalculated using the revised allocation percentages.');
  };

  const handleSaveSetup = () => {
    if (!periodStart || !periodEnd) {
      setSetupStatusMessage('Please complete the period covered before saving the budget setup.');
      setStep(1);
      return;
    }

    if (!allocationSummary.isBalanced) {
      setSetupStatusMessage(
        `Expense allocation must stay at 100% before saving Step 2. Current variance is ${allocationSummary.varianceToTarget.toFixed(2)}%.`,
      );
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
      {
        id: HOUSE_AMORTIZATION_KEY,
        label: 'Expense - House Amortization',
        setupAmount: toSafeNumber(expenseDraft[HOUSE_AMORTIZATION_KEY] ?? ''),
        type: 'expense',
      },
      {
        id: LOAN_AMORTIZATION_KEY,
        label: 'Expense - Loan Amortization',
        setupAmount: toSafeNumber(expenseDraft[LOAN_AMORTIZATION_KEY] ?? ''),
        type: 'expense',
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
    setActionsToBeTaken('');
    setSetupStatusMessage('Setup saved. Continue with Step 3 to enter actual values and monitor variance.');
    setStep(3);
  };

  const handleSaveOrFinishStepThree = () => {
    setSetupStatusMessage('Step 3 saved. Actions to be taken recorded.');
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
    const fixedObligationsTotal = toSafeNumber(expenseDraft[HOUSE_AMORTIZATION_KEY] ?? '')
      + toSafeNumber(expenseDraft[LOAN_AMORTIZATION_KEY] ?? '');
    const fixedObligationsGuidance = fixedObligationsTotal > 0
      ? `Fixed obligations (House + Loan Amortization) are currently ${formatCurrency(fixedObligationsTotal)}.`
      : 'Set House and Loan Amortization values to improve fixed-obligation forecasting.';

    if (varianceRows.length === 0) {
      return [
        `Save your setup to generate tailored recommendations for this budget period. ${fixedObligationsGuidance}`,
      ];
    }

    const hasAnyActual = varianceRows.some((item) => item.hasActual);
    if (!hasAnyActual) {
      return [
        `Start entering actual values in Step 3. AI recommendations will update as soon as variances are available. ${fixedObligationsGuidance}`,
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
      `Projected net cashflow is ${formatSignedCurrency(setupVsActualSummary.actualNet || setupVsActualSummary.setupNet)}. ${fixedObligationsGuidance} Keep at least one month of fixed obligations in reserve.`,
    );

    return recommendations.slice(0, 4);
  }, [expenseDraft, varianceRows, setupVsActualSummary.actualNet, setupVsActualSummary.setupNet]);

  return (
    <div className="psychometric-page budget-dashboard-page">
      <section className="psychometric-hero budget-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Budget Workflow Controls</span>
          <h1>Budget and Expense Tracker</h1>
          <p>
            As of covering period:{' '}
            <strong>
              {periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : snapshot.periodLabel}
            </strong>
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
                <h3 className="workflow-duplicate-step-title">Step 1: Choose Period Covered</h3>
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
                <h3 className="workflow-duplicate-step-title">Step 2: Set Up Baseline</h3>
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

                <div
                  className={`rounded-lg border p-4 ${
                    budgetAiSummary.status === 'surplus'
                      ? 'border-emerald-200 bg-emerald-50'
                      : budgetAiSummary.status === 'deficit'
                        ? 'border-rose-200 bg-rose-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Full Summary Box
                      </p>
                      <h4 className="mt-1 text-base font-bold text-slate-900">{budgetAiSummary.headline}</h4>
                      <p className="mt-2 text-sm text-slate-700">{budgetAiSummary.detail}</p>
                    </div>
                    <div className="grid gap-2 text-sm md:min-w-[220px]">
                      <div className="rounded-md bg-white/80 px-3 py-2">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Total Income</span>
                        <strong className="text-slate-900">{formatCurrency(budgetSetupTotals.incomeTotal)}</strong>
                      </div>
                      <div className="rounded-md bg-white/80 px-3 py-2">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Total Expenses</span>
                        <strong className="text-slate-900">{formatCurrency(budgetSetupTotals.expenseTotal)}</strong>
                      </div>
                      <div className="rounded-md bg-white/80 px-3 py-2">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Savings Impact</span>
                        <strong className={budgetSetupTotals.net > 0 ? 'text-emerald-700' : budgetSetupTotals.net < 0 ? 'text-rose-700' : 'text-slate-900'}>
                          {formatSignedCurrency(budgetSetupTotals.net)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-md border border-white/70 bg-white/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">AI Recommendation</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{budgetAiSummary.recommendation}</p>
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

                <h4 className="budget-workflow-subtitle">Fixed Amortization Expenses</h4>
                <div className="budget-workflow-grid-two">
                  <label>
                    House Amortization
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={expenseDraft[HOUSE_AMORTIZATION_KEY] ?? ''}
                      onChange={(event) => {
                        setExpenseDraft((previous) => ({
                          ...previous,
                          [HOUSE_AMORTIZATION_KEY]: event.target.value,
                        }));
                      }}
                      className="budget-dashboard-category-input"
                      placeholder="0"
                      aria-label="House amortization setup amount"
                    />
                  </label>
                  <label>
                    Loan Amortization
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={expenseDraft[LOAN_AMORTIZATION_KEY] ?? ''}
                      onChange={(event) => {
                        setExpenseDraft((previous) => ({
                          ...previous,
                          [LOAN_AMORTIZATION_KEY]: event.target.value,
                        }));
                      }}
                      className="budget-dashboard-category-input"
                      placeholder="0"
                      aria-label="Loan amortization setup amount"
                    />
                  </label>
                </div>

                <h4 className="budget-workflow-subtitle">Itemized Expense Setup</h4>
                <div className="budget-dashboard-category-summary">
                  <div className="budget-dashboard-category-summary-card">
                    <span>Total Allocation</span>
                    <strong>{allocationSummary.totalAllocation.toFixed(2)}%</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Variance to 100%</span>
                    <strong>{allocationSummary.varianceToTarget.toFixed(2)}%</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Status</span>
                    <strong>{allocationSummary.isBalanced ? 'Balanced' : 'Needs Reconciliation'}</strong>
                  </div>
                </div>
                <p className="psychometric-section-note">
                  Revise the budget allocation percentage per expense, then apply or normalize it. The allocation must remain at 100% before Step 2 can be saved.
                </p>
                <div className="budget-dashboard-category-grid">
                  {snapshot.categoryItems.map((item) => (
                    <article key={item.id} className="budget-dashboard-card">
                      <div className="budget-dashboard-card-header">
                        <span className="budget-expense-card-type">{item.label}</span>
                        <strong className="budget-expense-card-suggested">{formatPercentInput(item.share)}% suggested</strong>
                      </div>
                      <label className="budget-dashboard-category-input-wrap">
                        <span className="budget-dashboard-category-input-label">Budget Allocation %</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={expenseAllocationDraft[item.id] ?? ''}
                          onChange={(event) => {
                            setExpenseAllocationDraft((previous) => ({
                              ...previous,
                              [item.id]: event.target.value,
                            }));
                          }}
                          className="budget-dashboard-category-input"
                          aria-label={`${item.label} budget allocation percentage`}
                        />
                      </label>
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
                  <button type="button" className="budget-dashboard-category-reset" onClick={handleNormalizeExpenseAllocation}>
                    Normalize to 100%
                  </button>
                  <button type="button" className="budget-dashboard-category-reset" onClick={handleApplyExpenseAllocation}>
                    Apply Revised % Allocation
                  </button>
                  <button type="button" className="psychometric-reset-button" onClick={handleSaveSetup}>
                    Save Setup and Continue to Step 3
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="budget-workflow-step-block">
                <h3 className="workflow-duplicate-step-title">Step 3: Actual vs Setup Variance</h3>
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

                <div className="budget-workflow-actions-block">
                  <label htmlFor="budget-actions-to-be-taken" className="budget-workflow-actions-label">
                    Actions to be taken
                  </label>
                  <textarea
                    id="budget-actions-to-be-taken"
                    value={actionsToBeTaken}
                    onChange={(event) => setActionsToBeTaken(event.target.value)}
                    placeholder="Enter actions to be taken based on the variance review"
                    rows={4}
                    className="budget-workflow-actions-textarea"
                  />
                  <div className="budget-workflow-inline-actions">
                    <button type="button" className="psychometric-reset-button" onClick={handleSaveOrFinishStepThree}>
                      Save / Finish
                    </button>
                  </div>
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
                const stepPercent = stepCompletionById[workflowStep.id];
                const statusLabel = `${stepPercent}% information provided`;

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
                      <div className="lending-step-information-track" aria-hidden="true">
                        <div
                          className={`lending-step-information-bar${stepPercent < 30 ? ' lending-step-information-bar-low' : ''}`}
                          style={{ width: `${stepPercent}%` }}
                        />
                      </div>
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

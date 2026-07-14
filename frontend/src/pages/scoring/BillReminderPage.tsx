import { useCallback, useMemo, useState, type FormEvent } from 'react';

import { useAutosaveDraft } from '../../autosave';
import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildBillReminderSnapshot } from './liveTrackerMetrics';

type WorkflowStep = 1 | 2 | 3;
type BillerFrequency = 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'Weekly';

type BillerSetup = {
  id: string;
  company: string;
  utilityType: string;
  frequency: BillerFrequency;
  dateCovered: string;
  budgetedAmount: number;
};

interface BillReminderDraft {
  step: WorkflowStep;
  periodStart: string;
  periodEnd: string;
  draftBillers: BillerSetup[];
  editingBillerId: string | null;
  company: string;
  utilityType: string;
  frequency: BillerFrequency;
  budgetedAmount: string;
  savedSetup: BillerSetup[];
  actualEntries: Record<string, string>;
  varianceNotes: Record<string, string>;
  step3RecordSavedAt: string;
}

const DEFAULT_BILL_REMINDER_DRAFT: BillReminderDraft = {
  step: 1,
  periodStart: '',
  periodEnd: '',
  draftBillers: [],
  editingBillerId: null,
  company: '',
  utilityType: '',
  frequency: 'Monthly',
  budgetedAmount: '',
  savedSetup: [],
  actualEntries: {},
  varianceNotes: {},
  step3RecordSavedAt: '',
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

function toSafeNumber(rawValue: string | number | undefined) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function isBlank(rawValue: string | undefined) {
  return (rawValue ?? '').trim() === '';
}

function getBillerStatus(dateCovered: string) {
  const now = new Date();
  const due = new Date(dateCovered);
  if (Number.isNaN(due.getTime())) {
    return {
      id: 'watch' as const,
      label: 'Date Needed',
      note: 'Update coverage date',
      daysUntil: Number.NaN,
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const daysUntil = Math.round((startOfDue - startOfNow) / msPerDay);

  if (daysUntil < 0) {
    return {
      id: 'attention' as const,
      label: 'Past Due',
      note: `${Math.abs(daysUntil)} day(s) overdue`,
      daysUntil,
    };
  }

  if (daysUntil <= 5) {
    return {
      id: 'watch' as const,
      label: 'Due Soon',
      note: `${daysUntil} day(s) remaining`,
      daysUntil,
    };
  }

  return {
    id: 'maintain' as const,
    label: 'On Track',
    note: `${daysUntil} day(s) until due date`,
    daysUntil,
  };
}

function buildVarianceExplanation(variance: number) {
  if (variance === 0) {
    return 'On budget target';
  }
  return variance > 0
    ? 'Actual payment is above budgeted amount'
    : 'Actual payment is below budgeted amount';
}

export default function BillReminderPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const snapshot = useMemo(
    () => buildBillReminderSnapshot(applications),
    [applications],
  );

  const [step, setStep] = useState<WorkflowStep>(1);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const [draftBillers, setDraftBillers] = useState<BillerSetup[]>([]);
  const [editingBillerId, setEditingBillerId] = useState<string | null>(null);

  const [company, setCompany] = useState('');
  const [utilityType, setUtilityType] = useState('');
  const [frequency, setFrequency] = useState<BillerFrequency>('Monthly');
  const [budgetedAmount, setBudgetedAmount] = useState('');

  const [savedSetup, setSavedSetup] = useState<BillerSetup[]>([]);
  const [actualEntries, setActualEntries] = useState<Record<string, string>>({});
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({});
  const [step3RecordSavedAt, setStep3RecordSavedAt] = useState('');
  const [setupStatusMessage, setSetupStatusMessage] = useState('');

  const autosaveValue = useMemo<BillReminderDraft>(() => ({
    step,
    periodStart,
    periodEnd,
    draftBillers,
    editingBillerId,
    company,
    utilityType,
    frequency,
    budgetedAmount,
    savedSetup,
    actualEntries,
    varianceNotes,
    step3RecordSavedAt,
  }), [
    actualEntries,
    budgetedAmount,
    company,
    draftBillers,
    editingBillerId,
    frequency,
    periodEnd,
    periodStart,
    savedSetup,
    step,
    step3RecordSavedAt,
    utilityType,
    varianceNotes,
  ]);

  const handleAutosaveHydrate = useCallback((draft: BillReminderDraft) => {
    setStep(draft.step);
    setPeriodStart(draft.periodStart);
    setPeriodEnd(draft.periodEnd);
    setDraftBillers(draft.draftBillers);
    setEditingBillerId(draft.editingBillerId);
    setCompany(draft.company);
    setUtilityType(draft.utilityType);
    setFrequency(draft.frequency);
    setBudgetedAmount(draft.budgetedAmount);
    setSavedSetup(draft.savedSetup);
    setActualEntries(draft.actualEntries);
    setVarianceNotes(draft.varianceNotes);
    setStep3RecordSavedAt(draft.step3RecordSavedAt ?? '');
  }, []);

  useAutosaveDraft({
    scope: 'bill-reminder',
    entityKey: 'primary',
    value: autosaveValue,
    defaults: DEFAULT_BILL_REMINDER_DRAFT,
    onHydrate: handleAutosaveHydrate,
  });

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

  const currentStepLabel = workflowSteps.find((item) => item.id === step)?.label ?? 'Bill Workflow';
  const completionPercent = Math.round((step / workflowSteps.length) * 100);
  const stepperButtonClass = 'loan-stepper-button';

  const draftCards = useMemo(
    () =>
      [...draftBillers]
        .map((biller) => ({
          ...biller,
          status: getBillerStatus(biller.dateCovered),
        }))
        .sort((left, right) => {
          const leftDays = Number.isNaN(left.status.daysUntil) ? Number.POSITIVE_INFINITY : left.status.daysUntil;
          const rightDays = Number.isNaN(right.status.daysUntil) ? Number.POSITIVE_INFINITY : right.status.daysUntil;
          return leftDays - rightDays;
        }),
    [draftBillers],
  );

  const dueSoonCount = useMemo(
    () => draftCards.filter((biller) => biller.status.id === 'watch').length,
    [draftCards],
  );
  const pastDueCount = useMemo(
    () => draftCards.filter((biller) => biller.status.id === 'attention').length,
    [draftCards],
  );

  const draftBudgetTotal = useMemo(
    () => draftBillers.reduce((sum, biller) => sum + biller.budgetedAmount, 0),
    [draftBillers],
  );

  const savedBudgetTotal = useMemo(
    () => savedSetup.reduce((sum, biller) => sum + biller.budgetedAmount, 0),
    [savedSetup],
  );

  const resetForm = () => {
    setEditingBillerId(null);
    setCompany('');
    setUtilityType('');
    setFrequency('Monthly');
    setBudgetedAmount('');
  };

  const handleAddBiller = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!company.trim() || !utilityType.trim() || isBlank(budgetedAmount)) {
      return;
    }

    const budgetAmount = toSafeNumber(budgetedAmount);

    if (editingBillerId) {
      setDraftBillers((previous) =>
        previous.map((biller) =>
          biller.id === editingBillerId
            ? {
                ...biller,
                company: company.trim(),
                utilityType: utilityType.trim(),
                frequency,
                budgetedAmount: budgetAmount,
              }
            : biller,
        ),
      );
      resetForm();
      return;
    }

    const fallbackCoveredDate = periodEnd || periodStart || new Date().toISOString().slice(0, 10);

    setDraftBillers((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${previous.length + 1}`,
        company: company.trim(),
        utilityType: utilityType.trim(),
        frequency,
        dateCovered: fallbackCoveredDate,
        budgetedAmount: budgetAmount,
      },
    ]);

    resetForm();
  };

  const handleSaveSetup = () => {
    if (!periodStart || !periodEnd) {
      setSetupStatusMessage('Please complete period covered before saving this setup.');
      setStep(1);
      return;
    }

    if (draftBillers.length === 0) {
      setSetupStatusMessage('Please add at least one biller in Step 1 before saving setup.');
      setStep(1);
      return;
    }

    setSavedSetup(
      draftBillers.map((biller) => ({
        ...biller,
      })),
    );
    setActualEntries({});
    setVarianceNotes({});
    setStep3RecordSavedAt('');
    setSetupStatusMessage('Setup saved. Continue with Step 3 to enter actual values and monitor variance.');
    setStep(3);
  };

  const handleSaveVarianceRecord = () => {
    const hasComputedVariance = varianceRows.some((row) => row.hasActual);
    if (!hasComputedVariance) {
      setSetupStatusMessage('Please enter at least one actual amount in Step 3 before saving the record.');
      return;
    }

    setStep3RecordSavedAt(new Date().toISOString());
    setSetupStatusMessage('Step 3 record saved successfully.');
  };

  const varianceRows = useMemo(() => {
    return savedSetup.map((biller) => {
      const rawActual = actualEntries[biller.id] ?? '';
      const hasActual = !isBlank(rawActual);
      const actualAmount = hasActual ? toSafeNumber(rawActual) : 0;
      const variance = hasActual ? actualAmount - biller.budgetedAmount : 0;

      return {
        ...biller,
        hasActual,
        actualAmount,
        variance,
      };
    });
  }, [savedSetup, actualEntries]);

  const setupVsActualTotals = useMemo(() => {
    const setupTotal = varianceRows.reduce((sum, row) => sum + row.budgetedAmount, 0);
    const actualTotal = varianceRows
      .filter((row) => row.hasActual)
      .reduce((sum, row) => sum + row.actualAmount, 0);

    return {
      setupTotal,
      actualTotal,
      netVariance: actualTotal - setupTotal,
    };
  }, [varianceRows]);

  const topVarianceRows = useMemo(() => {
    return varianceRows
      .filter((row) => row.hasActual)
      .map((row) => ({
        ...row,
        magnitude: Math.abs(row.variance),
      }))
      .sort((left, right) => right.magnitude - left.magnitude)
      .slice(0, 5);
  }, [varianceRows]);

  const maxVarianceMagnitude = useMemo(
    () => topVarianceRows.reduce((largest, row) => Math.max(largest, row.magnitude), 0),
    [topVarianceRows],
  );

  const billsPaymentHealthScore = useMemo(() => {
    if (!draftCards.length) {
      return 0;
    }

    const total = draftCards.reduce((sum, biller) => {
      if (biller.status.id === 'maintain') {
        return sum + 100;
      }
      if (biller.status.id === 'watch') {
        return sum + 65;
      }
      return sum + 25;
    }, 0);

    return total / draftCards.length;
  }, [draftCards]);

  const aiRecommendations = useMemo(() => {
    if (!varianceRows.length) {
      return ['Save your setup to generate bill variance recommendations.'];
    }

    const hasAnyActual = varianceRows.some((row) => row.hasActual);
    if (!hasAnyActual) {
      return ['Start entering actual bill payments in Step 3 to activate AI recommendations.'];
    }

    const priorityRows = varianceRows
      .filter((row) => row.hasActual && row.variance > 0)
      .sort((left, right) => right.variance - left.variance)
      .slice(0, 3);

    const suggestions = priorityRows.map((row) => {
      return `${row.company} (${row.utilityType}) is over budget by ${formatCurrency(row.variance)}. Consider pre-scheduling payment and revising monthly allocation.`;
    });

    if (pastDueCount > 0) {
      suggestions.push('Settle past due billers first before discretionary payments to avoid late fees.');
    }

    if (suggestions.length === 0) {
      suggestions.push('Actual payments are within budgeted amounts. Keep variance explanations updated for each biller.');
    }

    suggestions.push(`Total bill variance is ${formatSignedCurrency(setupVsActualTotals.netVariance)} versus saved setup.`);

    return suggestions.slice(0, 4);
  }, [varianceRows, pastDueCount, setupVsActualTotals.netVariance]);

  return (
    <div className="psychometric-page bill-reminder-dashboard-page">
      <section className="psychometric-hero bill-reminder-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Billing Workflow Controls</span>
          <h1>Bill Reminder</h1>
          <p>
            Period: <strong>{snapshot.periodLabel}</strong> | Date: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Use a guided workflow to set period coverage, configure billers, save setup, and track actual
            payment variance with AI recommendations.
          </p>
        </div>

        <div className="psychometric-hero-metric bill-reminder-dashboard-scorecard">
          <span>Bills Payment Health Score</span>
          <strong>{billsPaymentHealthScore.toFixed(1)}</strong>
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
          <span>Draft Billers</span>
          <strong>{draftBillers.length}</strong>
          <small>Configured in setup workflow</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Saved Setup</span>
          <strong>{savedSetup.length}</strong>
          <small>Available for variance tracking</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Budget Total</span>
          <strong>{formatCurrency(draftBudgetTotal)}</strong>
          <small>Current draft budgeted bill amount</small>
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
                  In this same step, choose period covered and encode biller setup including company,
                  utility type or amortization, frequency, and budgeted amount.
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

                <form className="budget-workflow-income-grid" onSubmit={handleAddBiller}>
                  <label>
                    Company
                    <input
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder="Electric Company"
                      required
                    />
                  </label>

                  <label>
                    Utility Type or Amortization For
                    <input
                      value={utilityType}
                      onChange={(event) => setUtilityType(event.target.value)}
                      placeholder="Electricity or Home Loan Amortization"
                      required
                    />
                  </label>

                  <label>
                    Frequency
                    <select
                      value={frequency}
                      onChange={(event) => setFrequency(event.target.value as BillerFrequency)}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Semi-Annual">Semi-Annual</option>
                      <option value="Annual">Annual</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </label>

                  <label>
                    Budgeted Amount
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={budgetedAmount}
                      onChange={(event) => setBudgetedAmount(event.target.value)}
                      placeholder="0"
                      required
                    />
                  </label>

                  <div className="budget-workflow-inline-actions">
                    <button type="submit" className="psychometric-reset-button">
                      {editingBillerId ? 'Update Biller' : 'Add Biller'}
                    </button>
                    {editingBillerId ? (
                      <button
                        type="button"
                        className="budget-dashboard-category-reset"
                        onClick={resetForm}
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="psychometric-scale-table-wrap">
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Utility / Amortization</th>
                        <th>Frequency</th>
                        <th>Budgeted Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftCards.map((biller) => (
                        <tr key={biller.id}>
                          <td data-label="Company">{biller.company}</td>
                          <td data-label="Utility / Amortization">{biller.utilityType}</td>
                          <td data-label="Frequency">{biller.frequency}</td>
                          <td data-label="Budgeted Amount">{formatCurrency(biller.budgetedAmount)}</td>
                          <td data-label="Status">{biller.status.label}</td>
                          <td data-label="Actions">
                            <div className="budget-workflow-inline-actions">
                              <button
                                type="button"
                                className="budget-dashboard-category-reset"
                                onClick={() => {
                                  setEditingBillerId(biller.id);
                                  setCompany(biller.company);
                                  setUtilityType(biller.utilityType);
                                  setFrequency(biller.frequency);
                                  setBudgetedAmount(String(biller.budgetedAmount));
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="budget-dashboard-category-reset"
                                onClick={() => {
                                  setDraftBillers((previous) => previous.filter((item) => item.id !== biller.id));
                                  if (editingBillerId === biller.id) {
                                    resetForm();
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {draftCards.length === 0 ? (
                        <tr>
                          <td colSpan={6}>No billers added yet. Add at least one setup line.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
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
                  Review setup values, then click save. Saved lines will be shown in Step 3 first column for variance monitoring.
                </p>

                <div className="budget-dashboard-category-summary">
                  <div className="budget-dashboard-category-summary-card">
                    <span>Period Covered</span>
                    <strong>{periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Not set'}</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Biller Count</span>
                    <strong>{draftBillers.length}</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Budgeted Total</span>
                    <strong>{formatCurrency(draftBudgetTotal)}</strong>
                  </div>
                </div>

                <div className="psychometric-scale-table-wrap">
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Utility / Amortization</th>
                        <th>Frequency</th>
                        <th>Date Covered</th>
                        <th>Budgeted Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftBillers.map((biller) => (
                        <tr key={biller.id}>
                          <td data-label="Company">{biller.company}</td>
                          <td data-label="Utility / Amortization">{biller.utilityType}</td>
                          <td data-label="Frequency">{biller.frequency}</td>
                          <td data-label="Date Covered">{biller.dateCovered || 'Not set'}</td>
                          <td data-label="Budgeted Amount">{formatCurrency(biller.budgetedAmount)}</td>
                        </tr>
                      ))}
                      {draftBillers.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No billers to review yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
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
                <h3 className="workflow-duplicate-step-title">Step 3: Actual vs Setup Variance</h3>
                <p className="psychometric-section-note">
                  First column shows saved setup. Second column is blank for user actuals. Third column shows variance.
                  Fourth column provides variance explanation in small letters.
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
                          <th>Setup (Saved)</th>
                          <th>Actual (User Input)</th>
                          <th>Variance (B/W)</th>
                          <th>Variance Explanation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {varianceRows.map((row) => (
                          <tr key={row.id}>
                            <td data-label="Setup (Saved)">
                              <strong>{row.company}</strong>
                              <div>{row.utilityType}</div>
                              <div>{row.frequency}</div>
                              <div>{row.dateCovered || 'No date covered'}</div>
                              <div>{formatCurrency(row.budgetedAmount)}</div>
                            </td>
                            <td data-label="Actual (User Input)">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={actualEntries[row.id] ?? ''}
                                onChange={(event) => {
                                  setActualEntries((previous) => ({
                                    ...previous,
                                    [row.id]: event.target.value,
                                  }));
                                }}
                                placeholder="Enter actual payment"
                                aria-label={`${row.company} actual payment`}
                              />
                            </td>
                            <td
                              data-label="Variance (B/W)"
                              className={`bill-reminder-variance-cell ${row.hasActual ? (row.variance < 0 ? 'bill-reminder-variance-lower' : (row.variance > 0 ? 'bill-reminder-variance-higher' : 'bill-reminder-variance-neutral')) : 'bill-reminder-variance-pending'}`}
                            >
                              {row.hasActual ? formatSignedCurrency(row.variance) : 'Pending input'}
                            </td>
                            <td data-label="Variance Explanation">
                              <small className="budget-workflow-variance-copy">
                                {row.hasActual
                                  ? (varianceNotes[row.id]?.trim() || buildVarianceExplanation(row.variance))
                                  : 'Awaiting user actual amount.'}
                              </small>
                              {row.hasActual ? (
                                <input
                                  type="text"
                                  value={varianceNotes[row.id] ?? ''}
                                  onChange={(event) => {
                                    setVarianceNotes((previous) => ({
                                      ...previous,
                                      [row.id]: event.target.value,
                                    }));
                                  }}
                                  placeholder="Optional explanation"
                                  aria-label={`${row.company} variance explanation`}
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
                  <button type="button" className="psychometric-reset-button" onClick={handleSaveVarianceRecord}>
                    Save
                  </button>
                </div>

                {step3RecordSavedAt ? (
                  <p className="psychometric-section-note">
                    Last saved: {new Date(step3RecordSavedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>

          {step === 3 ? (
            <article className="psychometric-panel">
              <div className="psychometric-panel-header">
                <div>
                  <span className="psychometric-panel-kicker">AI Recommendations and Graphs</span>
                  <h2>Variance coaching for bill monitoring</h2>
                </div>
              </div>

              <div className="budget-workflow-ai-grid">
                <article className="budget-workflow-ai-card">
                  <h3>AI Recommendations</h3>
                  <ul className="psychometric-breakdown-list">
                    {aiRecommendations.map((item) => (
                      <li key={item}>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="budget-workflow-ai-card">
                  <h3>Setup vs Actual Graph</h3>
                  <div className="budget-workflow-graph-row">
                    <span>Saved Setup Total</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className="budget-workflow-graph-bar budget-workflow-graph-bar-setup"
                        style={{
                          width: `${Math.min(
                            100,
                            setupVsActualTotals.setupTotal > 0
                              ? (setupVsActualTotals.setupTotal / Math.max(setupVsActualTotals.setupTotal, setupVsActualTotals.actualTotal, 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCurrency(setupVsActualTotals.setupTotal)}</strong>
                  </div>

                  <div className="budget-workflow-graph-row">
                    <span>Actual Total</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className="budget-workflow-graph-bar budget-workflow-graph-bar-warning"
                        style={{
                          width: `${Math.min(
                            100,
                            setupVsActualTotals.actualTotal > 0
                              ? (setupVsActualTotals.actualTotal / Math.max(setupVsActualTotals.setupTotal, setupVsActualTotals.actualTotal, 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCurrency(setupVsActualTotals.actualTotal)}</strong>
                  </div>

                  <div className="budget-workflow-graph-row">
                    <span>Net Variance</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className={`budget-workflow-graph-bar ${setupVsActualTotals.netVariance > 0 ? 'budget-workflow-graph-bar-alert' : 'budget-workflow-graph-bar-actual'}`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.abs(setupVsActualTotals.netVariance) > 0
                              ? (Math.abs(setupVsActualTotals.netVariance) / Math.max(Math.abs(setupVsActualTotals.setupTotal), 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatSignedCurrency(setupVsActualTotals.netVariance)}</strong>
                  </div>
                </article>

                <article className="budget-workflow-ai-card">
                  <h3>Top Variance Graph</h3>
                  {topVarianceRows.length === 0 ? (
                    <p className="psychometric-section-note">Enter actual values to visualize top variance billers.</p>
                  ) : (
                    <div className="budget-workflow-variance-chart">
                      {topVarianceRows.map((row) => (
                        <div key={row.id} className="budget-workflow-variance-row">
                          <span>{row.company}</span>
                          <div className="budget-workflow-graph-track">
                            <div
                              className={`budget-workflow-graph-bar ${row.variance > 0 ? 'budget-workflow-graph-bar-warning' : 'budget-workflow-graph-bar-setup'}`}
                              style={{
                                width: `${maxVarianceMagnitude > 0 ? (row.magnitude / maxVarianceMagnitude) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <strong>{formatSignedCurrency(row.variance)}</strong>
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

            <div className="lending-psychometric-step-list">
              {workflowSteps.map((workflowStep) => {
                const isActive = step === workflowStep.id;
                const isCompleted = step > workflowStep.id;
                const statusLabel = isActive ? 'Current step' : isCompleted ? 'Completed' : 'Pending';

                return (
                  <button
                    key={workflowStep.id}
                    type="button"
                    onClick={() => setStep(workflowStep.id)}
                    className={`${stepperButtonClass} lending-psychometric-step-button ${isActive ? 'loan-stepper-button-active border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'loan-stepper-button-idle border-gray-200 bg-white hover:border-blue-400 hover:text-blue-600'}`}
                  >
                    <div className={`lending-psychometric-step-index ${isActive || isCompleted ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {workflowStep.id}
                    </div>
                    <div className="lending-psychometric-step-copy">
                      <strong>{workflowStep.label}</strong>
                      <span>{`${statusLabel} · ${workflowStep.description}`}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Setup Snapshot</span>
            <h2>{savedSetup.length > 0 ? 'Setup Saved' : 'Setup Draft'}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Period Covered</span>
                <strong>{periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Not set'}</strong>
              </li>
              <li>
                <span>Draft Budget</span>
                <strong>{formatCurrency(draftBudgetTotal)}</strong>
              </li>
              <li>
                <span>Saved Budget</span>
                <strong>{formatCurrency(savedBudgetTotal)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Due Health</span>
            <h2>{snapshot.performanceBand}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Due Soon</span>
                <strong>{dueSoonCount}</strong>
              </li>
              <li>
                <span>Past Due</span>
                <strong>{pastDueCount}</strong>
              </li>
              <li>
                <span>Ready to Pay</span>
                <strong>{snapshot.readyToPayCount}</strong>
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  );
}

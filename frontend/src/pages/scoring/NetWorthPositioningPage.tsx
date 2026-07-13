import { useCallback, useMemo, useState } from 'react';

import { useAutosaveDraft } from '../../autosave';
import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildNetWorthPositioningSnapshot } from './liveTrackerMetrics';

type WorkflowStep = 1 | 2 | 3;
type BalanceSheetSection = 'assets' | 'liabilities' | 'equities';

type BalanceSheetEntry = {
  id: string;
  label: string;
  section: BalanceSheetSection;
};

type SavedLine = {
  id: string;
  label: string;
  section: BalanceSheetSection;
  setupAmount: number;
};

interface NetWorthPositioningDraft {
  step: WorkflowStep;
  periodStart: string;
  periodEnd: string;
  amounts: Record<string, string>;
  savedSetup: SavedLine[];
  actualEntries: Record<string, string>;
  varianceNotes: Record<string, string>;
}

const DEFAULT_NET_WORTH_POSITIONING_DRAFT: NetWorthPositioningDraft = {
  step: 1,
  periodStart: '',
  periodEnd: '',
  amounts: {},
  savedSetup: [],
  actualEntries: {},
  varianceNotes: {},
};

const BALANCE_SHEET_ENTRIES: BalanceSheetEntry[] = [
  { id: 'cash-savings', label: 'Cash and Savings', section: 'assets' },
  { id: 'investments', label: 'Investments', section: 'assets' },
  { id: 'real-estate', label: 'Real Estate', section: 'assets' },
  { id: 'vehicles', label: 'Vehicles', section: 'assets' },
  { id: 'business-assets', label: 'Business Assets', section: 'assets' },
  { id: 'other-assets', label: 'Other Assets', section: 'assets' },
  { id: 'credit-cards', label: 'Credit Cards', section: 'liabilities' },
  { id: 'personal-loans', label: 'Personal Loans', section: 'liabilities' },
  { id: 'mortgage-balance', label: 'Mortgage Balance', section: 'liabilities' },
  { id: 'auto-loan', label: 'Auto Loan', section: 'liabilities' },
  { id: 'other-liabilities', label: 'Other Liabilities', section: 'liabilities' },
  { id: 'owner-equity', label: 'Owner Equity', section: 'equities' },
  { id: 'retained-savings', label: 'Retained Savings', section: 'equities' },
  { id: 'business-equity', label: 'Business Equity', section: 'equities' },
  { id: 'other-equity', label: 'Other Equity', section: 'equities' },
];

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

function getSectionLabel(section: BalanceSheetSection) {
  if (section === 'assets') {
    return 'Asset';
  }
  if (section === 'liabilities') {
    return 'Liability';
  }
  return 'Equity';
}

function buildVarianceExplanation(section: BalanceSheetSection, variance: number) {
  if (variance === 0) {
    return 'On target versus setup';
  }

  if (section === 'liabilities') {
    return variance > 0
      ? 'Liability increased above setup and needs control'
      : 'Liability is lower than setup and improves net worth';
  }

  return variance > 0
    ? 'Value improved above setup and supports net worth'
    : 'Value declined below setup and weakens net worth';
}

export default function NetWorthPositioningPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const snapshot = useMemo(
    () => buildNetWorthPositioningSnapshot(applications),
    [applications],
  );

  const [step, setStep] = useState<WorkflowStep>(1);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [savedSetup, setSavedSetup] = useState<SavedLine[]>([]);
  const [actualEntries, setActualEntries] = useState<Record<string, string>>({});
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({});
  const [setupStatusMessage, setSetupStatusMessage] = useState('');

  const autosaveValue = useMemo<NetWorthPositioningDraft>(() => ({
    step,
    periodStart,
    periodEnd,
    amounts,
    savedSetup,
    actualEntries,
    varianceNotes,
  }), [
    actualEntries,
    amounts,
    periodEnd,
    periodStart,
    savedSetup,
    step,
    varianceNotes,
  ]);

  const handleAutosaveHydrate = useCallback((draft: NetWorthPositioningDraft) => {
    setStep(draft.step);
    setPeriodStart(draft.periodStart);
    setPeriodEnd(draft.periodEnd);
    setAmounts(draft.amounts);
    setSavedSetup(draft.savedSetup);
    setActualEntries(draft.actualEntries);
    setVarianceNotes(draft.varianceNotes);
  }, []);

  useAutosaveDraft({
    scope: 'net-worth-positioning',
    entityKey: 'primary',
    value: autosaveValue,
    defaults: DEFAULT_NET_WORTH_POSITIONING_DRAFT,
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

  const currentStepLabel = workflowSteps.find((item) => item.id === step)?.label ?? 'Net Worth Workflow';
  const completionPercent = Math.round((step / workflowSteps.length) * 100);
  const stepperButtonClass = 'loan-stepper-button';

  const setupRows = useMemo(
    () =>
      BALANCE_SHEET_ENTRIES.map((entry) => {
        const raw = amounts[entry.id] ?? '';
        return {
          ...entry,
          raw,
          amount: toSafeNumber(raw),
        };
      }),
    [amounts],
  );

  const setupAssetsTotal = useMemo(
    () => setupRows.filter((row) => row.section === 'assets').reduce((sum, row) => sum + row.amount, 0),
    [setupRows],
  );
  const setupLiabilitiesTotal = useMemo(
    () => setupRows.filter((row) => row.section === 'liabilities').reduce((sum, row) => sum + row.amount, 0),
    [setupRows],
  );
  const setupEquitiesTotal = useMemo(
    () => setupRows.filter((row) => row.section === 'equities').reduce((sum, row) => sum + row.amount, 0),
    [setupRows],
  );
  const setupNetWorth = setupAssetsTotal + setupEquitiesTotal - setupLiabilitiesTotal;

  const handleSaveSetup = () => {
    if (!periodStart || !periodEnd) {
      setSetupStatusMessage('Please complete period covered before saving this net worth setup.');
      setStep(1);
      return;
    }

    const setupLines = setupRows
      .filter((row) => row.amount > 0)
      .map((row) => ({
        id: row.id,
        label: row.label,
        section: row.section,
        setupAmount: row.amount,
      }));

    if (setupLines.length === 0) {
      setSetupStatusMessage('Please enter at least one balance sheet amount before saving setup.');
      setStep(1);
      return;
    }

    setSavedSetup(setupLines);
    setActualEntries({});
    setVarianceNotes({});
    setSetupStatusMessage('Setup saved. Continue with Step 3 to enter actual values and monitor variance.');
    setStep(3);
  };

  const varianceRows = useMemo(() => {
    return savedSetup.map((line) => {
      const rawActual = actualEntries[line.id] ?? '';
      const hasActual = !isBlank(rawActual);
      const actualAmount = hasActual ? toSafeNumber(rawActual) : 0;
      const variance = hasActual ? actualAmount - line.setupAmount : 0;

      return {
        ...line,
        hasActual,
        actualAmount,
        variance,
      };
    });
  }, [savedSetup, actualEntries]);

  const totals = useMemo(() => {
    const setupAssets = varianceRows
      .filter((row) => row.section === 'assets')
      .reduce((sum, row) => sum + row.setupAmount, 0);
    const setupLiabilities = varianceRows
      .filter((row) => row.section === 'liabilities')
      .reduce((sum, row) => sum + row.setupAmount, 0);
    const setupEquities = varianceRows
      .filter((row) => row.section === 'equities')
      .reduce((sum, row) => sum + row.setupAmount, 0);

    const actualAssets = varianceRows
      .filter((row) => row.section === 'assets' && row.hasActual)
      .reduce((sum, row) => sum + row.actualAmount, 0);
    const actualLiabilities = varianceRows
      .filter((row) => row.section === 'liabilities' && row.hasActual)
      .reduce((sum, row) => sum + row.actualAmount, 0);
    const actualEquities = varianceRows
      .filter((row) => row.section === 'equities' && row.hasActual)
      .reduce((sum, row) => sum + row.actualAmount, 0);

    return {
      setupAssets,
      setupLiabilities,
      setupEquities,
      setupNetWorth: setupAssets + setupEquities - setupLiabilities,
      actualAssets,
      actualLiabilities,
      actualEquities,
      actualNetWorth: actualAssets + actualEquities - actualLiabilities,
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

  const aiRecommendations = useMemo(() => {
    if (!varianceRows.length) {
      return ['Save setup first so recommendations can be generated.'];
    }

    const hasAnyActual = varianceRows.some((row) => row.hasActual);
    if (!hasAnyActual) {
      return ['Enter actual values in Step 3 to unlock AI recommendations for net worth variance.'];
    }

    const prioritized = varianceRows
      .filter((row) => row.hasActual)
      .map((row) => {
        const riskMagnitude = row.section === 'liabilities'
          ? Math.max(row.variance, 0)
          : Math.max(-row.variance, 0);
        return {
          ...row,
          riskMagnitude,
        };
      })
      .sort((left, right) => right.riskMagnitude - left.riskMagnitude)
      .slice(0, 3)
      .filter((row) => row.riskMagnitude > 0);

    const recommendations = prioritized.map((row) => {
      if (row.section === 'liabilities') {
        return `${row.label} is above setup by ${formatCurrency(row.variance)}. Prioritize payoff sequencing to protect net worth.`;
      }
      return `${row.label} is below setup by ${formatCurrency(Math.abs(row.variance))}. Rebuild this value area to stabilize net worth.`;
    });

    if (recommendations.length === 0) {
      recommendations.push('Actual values are aligned with setup. Keep updating variance explanations to maintain tracking quality.');
    }

    recommendations.push(`Net worth projection is ${formatSignedCurrency(totals.actualNetWorth || totals.setupNetWorth)} using current entries.`);

    return recommendations.slice(0, 4);
  }, [varianceRows, totals.actualNetWorth, totals.setupNetWorth]);

  return (
    <div className="psychometric-page networth-dashboard-page">
      <section className="psychometric-hero networth-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Net Worth Workflow Controls</span>
          <h1>Net Worth Tracking</h1>
          <p>
            Period: <strong>{snapshot.periodLabel}</strong> | Date: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Navigate a guided net-worth workflow to set period coverage, build setup amounts, then compare
            actual values and track variances with AI guidance.
          </p>
        </div>

        <div className="psychometric-hero-metric networth-dashboard-scorecard">
          <span>Net Worth Position Score</span>
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
          <span>Setup Assets</span>
          <strong>{formatCurrency(setupAssetsTotal)}</strong>
          <small>Current setup for asset lines</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Setup Liabilities</span>
          <strong>{formatCurrency(setupLiabilitiesTotal)}</strong>
          <small>Current setup for liability lines</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Setup Net Worth</span>
          <strong>{formatSignedCurrency(setupNetWorth)}</strong>
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
                  Select period covered, then encode setup amounts for assets, liabilities, and equities.
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

                <div className="psychometric-scale-table-wrap">
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>Line Item</th>
                        <th>Setup Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {setupRows.map((row) => (
                        <tr key={row.id}>
                          <td data-label="Section">{getSectionLabel(row.section)}</td>
                          <td data-label="Line Item">{row.label}</td>
                          <td data-label="Setup Amount">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={row.raw}
                              onChange={(event) => {
                                setAmounts((previous) => ({
                                  ...previous,
                                  [row.id]: event.target.value,
                                }));
                              }}
                              className="budget-dashboard-category-input"
                              placeholder="0"
                              aria-label={`${row.label} setup amount`}
                            />
                          </td>
                        </tr>
                      ))}
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
                <h3>Step 2: Set Up Baseline</h3>
                <p className="psychometric-section-note">
                  Review setup values, then click save setup so lines appear in Step 3 first column.
                </p>

                <div className="budget-dashboard-category-summary">
                  <div className="budget-dashboard-category-summary-card">
                    <span>Period Covered</span>
                    <strong>{periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Not set'}</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Setup Entries</span>
                    <strong>{setupRows.filter((row) => row.amount > 0).length}</strong>
                  </div>
                  <div className="budget-dashboard-category-summary-card">
                    <span>Setup Net Worth</span>
                    <strong>{formatSignedCurrency(setupNetWorth)}</strong>
                  </div>
                </div>

                <div className="psychometric-scale-table-wrap">
                  <table className="psychometric-scale-table">
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>Line Item</th>
                        <th>Setup Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {setupRows
                        .filter((row) => row.amount > 0)
                        .map((row) => (
                          <tr key={row.id}>
                            <td data-label="Section">{getSectionLabel(row.section)}</td>
                            <td data-label="Line Item">{row.label}</td>
                            <td data-label="Setup Amount">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      {setupRows.filter((row) => row.amount > 0).length === 0 ? (
                        <tr>
                          <td colSpan={3}>No setup lines yet. Return to Step 1 and add values.</td>
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
                <h3>Step 3: Actual vs Setup Variance</h3>
                <p className="psychometric-section-note">
                  First column shows saved setup. Second column is blank for actual entry. Third column is variance.
                  Fourth column shows variance explanation in small letters.
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
                          <th>Variance</th>
                          <th>Variance Explanation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {varianceRows.map((row) => (
                          <tr key={row.id}>
                            <td data-label="Setup (Saved)">
                              <strong>{row.label}</strong>
                              <div>{getSectionLabel(row.section)}</div>
                              <div>{formatCurrency(row.setupAmount)}</div>
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
                                placeholder="Enter actual value"
                                aria-label={`${row.label} actual value`}
                              />
                            </td>
                            <td data-label="Variance">
                              {row.hasActual ? formatSignedCurrency(row.variance) : 'Pending input'}
                            </td>
                            <td data-label="Variance Explanation">
                              <small className="budget-workflow-variance-copy">
                                {row.hasActual
                                  ? (varianceNotes[row.id]?.trim() || buildVarianceExplanation(row.section, row.variance))
                                  : 'Awaiting actual value from user.'}
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
                                  aria-label={`${row.label} variance explanation`}
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
                  <span className="psychometric-panel-kicker">AI Recommendations and Graphs</span>
                  <h2>Net worth variance coaching and visuals</h2>
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
                  <h3>Setup vs Actual Net Worth Graph</h3>
                  <div className="budget-workflow-graph-row">
                    <span>Setup Net Worth</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className="budget-workflow-graph-bar budget-workflow-graph-bar-setup"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.abs(totals.setupNetWorth) > 0
                              ? (Math.abs(totals.setupNetWorth) / Math.max(Math.abs(totals.setupNetWorth), Math.abs(totals.actualNetWorth), 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatSignedCurrency(totals.setupNetWorth)}</strong>
                  </div>

                  <div className="budget-workflow-graph-row">
                    <span>Actual Net Worth</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className={`budget-workflow-graph-bar ${totals.actualNetWorth < totals.setupNetWorth ? 'budget-workflow-graph-bar-warning' : 'budget-workflow-graph-bar-actual'}`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.abs(totals.actualNetWorth) > 0
                              ? (Math.abs(totals.actualNetWorth) / Math.max(Math.abs(totals.setupNetWorth), Math.abs(totals.actualNetWorth), 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatSignedCurrency(totals.actualNetWorth)}</strong>
                  </div>

                  <div className="budget-workflow-graph-row">
                    <span>Net Worth Variance</span>
                    <div className="budget-workflow-graph-track">
                      <div
                        className={`budget-workflow-graph-bar ${totals.actualNetWorth - totals.setupNetWorth < 0 ? 'budget-workflow-graph-bar-alert' : 'budget-workflow-graph-bar-actual'}`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.abs(totals.actualNetWorth - totals.setupNetWorth) > 0
                              ? (Math.abs(totals.actualNetWorth - totals.setupNetWorth) / Math.max(Math.abs(totals.setupNetWorth), 1)) * 100
                              : 0,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatSignedCurrency(totals.actualNetWorth - totals.setupNetWorth)}</strong>
                  </div>
                </article>

                <article className="budget-workflow-ai-card">
                  <h3>Top Variance Graph</h3>
                  {topVarianceRows.length === 0 ? (
                    <p className="psychometric-section-note">Enter actual values to visualize top variance lines.</p>
                  ) : (
                    <div className="budget-workflow-variance-chart">
                      {topVarianceRows.map((row) => (
                        <div key={row.id} className="budget-workflow-variance-row">
                          <span>{row.label}</span>
                          <div className="budget-workflow-graph-track">
                            <div
                              className={`budget-workflow-graph-bar ${row.section === 'liabilities' && row.variance > 0 ? 'budget-workflow-graph-bar-warning' : 'budget-workflow-graph-bar-setup'}`}
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
            <h2>{savedSetup.length > 0 ? 'Saved Setup' : 'Draft Setup'}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Period Covered</span>
                <strong>{periodStart && periodEnd ? `${periodStart} to ${periodEnd}` : 'Not set'}</strong>
              </li>
              <li>
                <span>Setup Entries</span>
                <strong>{savedSetup.length || setupRows.filter((row) => row.amount > 0).length}</strong>
              </li>
              <li>
                <span>Setup Net Worth</span>
                <strong>{formatSignedCurrency(savedSetup.length > 0 ? totals.setupNetWorth : setupNetWorth)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Position Health</span>
            <h2>{snapshot.performanceBand}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Health Score</span>
                <strong>{snapshot.healthScore.toFixed(1)}</strong>
              </li>
              <li>
                <span>Action</span>
                <strong>{snapshot.actionLabel}</strong>
              </li>
              <li>
                <span>Source</span>
                <strong>{snapshot.sourceApplicationNo || 'N/A'}</strong>
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  );
}

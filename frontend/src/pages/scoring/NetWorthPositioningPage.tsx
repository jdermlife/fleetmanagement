import { Fragment, useEffect, useMemo, useState } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildNetWorthPositioningSnapshot } from './liveTrackerMetrics';

type BalanceSheetSection = 'assets' | 'liabilities' | 'equities';

type BalanceSheetEntry = {
  id: string;
  label: string;
  section: BalanceSheetSection;
};

const BALANCE_SHEET_STORAGE_KEY = 'fms:networth-balance-sheet';

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

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMetric(value: number, unit: 'percent' | 'days' | 'score' | 'currency' | 'count') {
  if (unit === 'currency') {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (unit === 'count') {
    return value.toFixed(0);
  }
  if (unit === 'days') {
    return `${value.toFixed(1)} days`;
  }
  if (unit === 'score') {
    return value.toFixed(1);
  }
  return formatPercent(value);
}

function getStatusLabel(status: 'maintain' | 'watch' | 'attention') {
  if (status === 'maintain') {
    return 'Maintain';
  }
  if (status === 'watch') {
    return 'Watch';
  }
  return 'Needs Attention';
}

function loadStoredBalanceSheet(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(BALANCE_SHEET_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function getSectionLabel(section: BalanceSheetSection) {
  if (section === 'assets') {
    return 'Assets';
  }
  if (section === 'liabilities') {
    return 'Liabilities';
  }
  return 'Equities';
}

function getTopBalanceSheetEntry(
  rows: Array<BalanceSheetEntry & { amount: number; raw: string }>,
): (BalanceSheetEntry & { amount: number; raw: string }) | null {
  return [...rows]
    .filter((row) => row.amount > 0)
    .sort((left, right) => right.amount - left.amount)[0] ?? null;
}

export default function NetWorthPositioningPage() {
  const { applications, error, lastUpdated } = useLoanApplicationsMetrics();
  const snapshot = useMemo(
    () => buildNetWorthPositioningSnapshot(applications),
    [applications],
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() => loadStoredBalanceSheet());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(BALANCE_SHEET_STORAGE_KEY, JSON.stringify(amounts));
  }, [amounts]);

  const latestFinancialApplication = useMemo(() => {
    const candidates = applications.filter((record) => {
      return record.monthly_income > 0 || record.other_income > 0 || record.debt_obligations > 0;
    });

    return [...candidates].sort((left, right) => {
      const rightTimestamp = Date.parse(right.updated_at ?? right.created_at ?? '') || 0;
      const leftTimestamp = Date.parse(left.updated_at ?? left.created_at ?? '') || 0;
      return rightTimestamp - leftTimestamp;
    })[0] ?? null;
  }, [applications]);

  const increasingExpensesCount = useMemo(() => {
    if (!latestFinancialApplication) {
      return 0;
    }

    const employment = latestFinancialApplication.requirements?.employmentInformation;
    const banking = latestFinancialApplication.requirements?.bankingRelationships;
    const grossIncome = Math.max(
      latestFinancialApplication.monthly_income + latestFinancialApplication.other_income,
      Number(employment?.grossMonthlyIncome ?? 0),
    );
    const livingExpenses = Number(employment?.monthlyLivingExpenses ?? 0);
    const mortgageExpense = Number(banking?.loanMonthlyAmortization ?? 0);
    const debtObligations = Number(latestFinancialApplication.debt_obligations ?? 0);

    if (grossIncome <= 0) {
      return 0;
    }

    return [
      livingExpenses / grossIncome > 0.45,
      debtObligations / grossIncome > 0.35,
      mortgageExpense / grossIncome > 0.28,
      grossIncome - livingExpenses - debtObligations < 0,
    ].filter(Boolean).length;
  }, [latestFinancialApplication]);

  const sectionRows = useMemo(
    () =>
      BALANCE_SHEET_ENTRIES.reduce<Record<BalanceSheetSection, Array<BalanceSheetEntry & { amount: number; raw: string }>>>(
        (accumulator, entry) => {
          const raw = amounts[entry.id] ?? '';
          const parsed = raw.trim() === '' ? 0 : Number(raw);
          accumulator[entry.section].push({
            ...entry,
            raw,
            amount: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
          });
          return accumulator;
        },
        { assets: [], liabilities: [], equities: [] },
      ),
    [amounts],
  );

  const totalAssets = useMemo(
    () => sectionRows.assets.reduce((sum, row) => sum + row.amount, 0),
    [sectionRows.assets],
  );
  const totalLiabilities = useMemo(
    () => sectionRows.liabilities.reduce((sum, row) => sum + row.amount, 0),
    [sectionRows.liabilities],
  );
  const totalEquities = useMemo(
    () => sectionRows.equities.reduce((sum, row) => sum + row.amount, 0),
    [sectionRows.equities],
  );
  const numberOfAssets = useMemo(
    () => sectionRows.assets.filter((row) => row.amount > 0).length,
    [sectionRows.assets],
  );
  const netWorth = totalAssets + totalEquities - totalLiabilities;
  const biggestLiability = useMemo(
    () => getTopBalanceSheetEntry(sectionRows.liabilities),
    [sectionRows.liabilities],
  );
  const biggestAsset = useMemo(
    () => getTopBalanceSheetEntry(sectionRows.assets),
    [sectionRows.assets],
  );
  const liabilitiesToAssetsRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const advisor = useMemo(() => {
    const debtAdvice =
      biggestLiability && biggestLiability.amount > 0
        ? `Focus first on reducing ${biggestLiability.label}, because it is currently your largest recorded liability and has the biggest effect on net worth.`
        : 'Add liability balances so the advisor can identify which obligation should be reduced first.';

    const expenseAdvice =
      increasingExpensesCount > 0
        ? `Expenses appear to be rising in ${increasingExpensesCount} pressure area(s). Review living expenses, debt obligations, and recurring monthly commitments before adding new liabilities.`
        : 'Current application signals do not show strong expense pressure. Keep protecting surplus cash and avoid unnecessary recurring commitments.';

    const netWorthAdvice =
      netWorth > 0 && liabilitiesToAssetsRatio < 60
        ? `Net worth is improving. ${biggestAsset ? `${biggestAsset.label} is currently your strongest asset anchor.` : 'Your asset base is stronger than your liabilities.'}`
        : netWorth > 0
          ? 'Net worth is still positive, but liabilities are taking a larger share of your assets. Prioritize liability reduction and preserve liquidity.'
          : 'Net worth is weak or negative right now. Focus on cutting liabilities, building liquid assets, and avoiding new debt until the balance sheet stabilizes.';

    return {
      debtAdvice,
      debtStatus: biggestLiability ? (biggestLiability.amount > totalAssets * 0.35 ? 'attention' : 'watch') : 'watch',
      expenseAdvice,
      expenseStatus: increasingExpensesCount > 1 ? 'attention' : increasingExpensesCount === 1 ? 'watch' : 'maintain',
      netWorthAdvice,
      netWorthStatus: netWorth > 0 && liabilitiesToAssetsRatio < 60 ? 'maintain' : netWorth > 0 ? 'watch' : 'attention',
    } as const;
  }, [biggestAsset, biggestLiability, increasingExpensesCount, liabilitiesToAssetsRatio, netWorth, totalAssets]);

  return (
    <div className="psychometric-page networth-dashboard-page">
      <section className="psychometric-hero networth-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Personal Net Worth Tracking</span>
          <h1>Net Worth Positioning</h1>
          <p>
            Period: <strong>{snapshot.periodLabel}</strong> | Date: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Built from live valuation cushions, debt pressure, liquidity surplus, and approval-band
            positioning so the balance-sheet picture is visible at portfolio level.
          </p>
        </div>

        <div className="psychometric-hero-metric networth-dashboard-scorecard">
          <span>Net Worth Position Score</span>
          <strong>{snapshot.healthScore.toFixed(1)}</strong>
          <small>{snapshot.performanceBand}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Number of Assets</span>
          <strong>{numberOfAssets}</strong>
          <small>Asset accounts with entered values</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Net Worth</span>
          <strong>{formatCurrency(netWorth)}</strong>
          <small>Total assets plus equities less liabilities</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Increasing Expenses</span>
          <strong>{increasingExpensesCount}</strong>
          <small>Expense pressure signals from the latest application</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Performance Band</span>
          <strong>{snapshot.performanceBand}</strong>
          <small>{snapshot.healthScore} / 100 weighted score</small>
        </article>
      </section>

      <section className="budget-dashboard-layout">
        <div className="budget-dashboard-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Balance Sheet</span>
                <h2>To be filled up for personal net worth monitoring</h2>
              </div>
              <button
                type="button"
                className="psychometric-reset-button"
                onClick={() => setAmounts({})}
                disabled={Object.keys(amounts).length === 0}
              >
                Reset Balance Sheet
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

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Accounts</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(['assets', 'liabilities', 'equities'] as BalanceSheetSection[]).map((section) => (
                    <Fragment key={section}>
                      <tr>
                        <td colSpan={2} style={{ fontWeight: 700 }}>{getSectionLabel(section)}</td>
                      </tr>
                      {sectionRows[section].map((row) => (
                        <tr key={row.id}>
                          <td>{row.label}</td>
                          <td>
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
                              aria-label={`${row.label} amount`}
                            />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Net Worth</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(netWorth)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Control Metrics</span>
                <h2>Actual vs target net-worth controls</h2>
              </div>
            </div>

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Actual</th>
                    <th>Target</th>
                    <th>Variance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.controlItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{formatMetric(item.actual, item.unit)}</td>
                      <td>{formatMetric(item.target, item.unit)}</td>
                      <td>{formatMetric(item.variance, item.unit)}</td>
                      <td>{getStatusLabel(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Position Indicators</span>
                <h2>Indicators to maintain and reposition</h2>
              </div>
            </div>

            <div className="budget-dashboard-indicator-row">
              {snapshot.indicators.map((indicator) => (
                <article key={indicator.id} className={`budget-dashboard-indicator budget-dashboard-status-${indicator.status}`}>
                  <span>{indicator.label}</span>
                  <strong>
                    {indicator.id === 'average-net-cashflow'
                      ? formatCurrency(indicator.value)
                      : formatPercent(indicator.value)}
                  </strong>
                  <small>
                    Target {indicator.id === 'average-net-cashflow'
                      ? formatCurrency(indicator.target)
                      : formatPercent(indicator.target)}
                  </small>
                  <p>{indicator.note}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">AI Advisor</span>
                <h2>Personal balance-sheet guidance</h2>
              </div>
            </div>

            <div className="budget-dashboard-indicator-row">
              <article className={`budget-dashboard-indicator budget-dashboard-status-${advisor.debtStatus}`}>
                <span>Liability Reduction Priority</span>
                <strong>{biggestLiability?.label ?? 'Add liabilities'}</strong>
                <p>{advisor.debtAdvice}</p>
              </article>

              <article className={`budget-dashboard-indicator budget-dashboard-status-${advisor.expenseStatus}`}>
                <span>Expenses vs Savings</span>
                <strong>{increasingExpensesCount > 0 ? 'Review Spending' : 'Stable Spending'}</strong>
                <p>{advisor.expenseAdvice}</p>
              </article>

              <article className={`budget-dashboard-indicator budget-dashboard-status-${advisor.netWorthStatus}`}>
                <span>Net Worth Direction</span>
                <strong>{netWorth > 0 ? 'Positive Net Worth' : 'Rebuild Net Worth'}</strong>
                <p>{advisor.netWorthAdvice}</p>
              </article>
            </div>
          </article>
        </div>

        <aside className="budget-dashboard-side">
          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Action</span>
            <h2>{snapshot.actionLabel}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Total assets</span>
                <strong>{formatCurrency(totalAssets)}</strong>
              </li>
              <li>
                <span>Total liabilities</span>
                <strong>{formatCurrency(totalLiabilities)}</strong>
              </li>
              <li>
                <span>Total equities</span>
                <strong>{formatCurrency(totalEquities)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Balance Sheet</span>
            <h2>{snapshot.performanceBand}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Number of assets</span>
                <strong>{numberOfAssets}</strong>
              </li>
              <li>
                <span>Increasing expenses</span>
                <strong>{increasingExpensesCount}</strong>
              </li>
              <li>
                <span>Net worth</span>
                <strong>{formatCurrency(netWorth)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Position Notes</span>
            <h2>Best-practice focus</h2>
            <p className="psychometric-section-note">
              This page emphasizes cashflow resilience, leverage control, valuation cushion, and
              decision-band distribution so net-worth positioning reflects practical credit strength.
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}

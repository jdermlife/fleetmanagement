import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import { buildBillReminderSnapshot } from './liveTrackerMetrics';

type BillerFrequency = 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'Weekly';

type BillerSetup = {
  id: string;
  name: string;
  facility: string;
  frequency: BillerFrequency;
  dueDate: string;
};

const BILLER_STORAGE_KEY = 'fms:bill-reminder-setup';

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

function getBillerStatus(dueDate: string) {
  const now = new Date();
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return {
      id: 'watch' as const,
      label: 'Due Date Needed',
      note: 'Update the biller with a valid due date.',
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
      label: 'Due Within 5 Days',
      note: `${daysUntil} day(s) remaining`,
      daysUntil,
    };
  }

  return {
    id: 'maintain' as const,
    label: 'Reminder',
    note: `${daysUntil} day(s) until due date`,
    daysUntil,
  };
}

function buildBillsPaymentHealthScore(billers: BillerSetup[]) {
  if (!billers.length) {
    return 0;
  }

  const scores = billers.map((biller) => {
    const status = getBillerStatus(biller.dueDate);
    if (status.id === 'maintain') {
      return 100;
    }
    if (status.id === 'watch') {
      return 65;
    }
    return 25;
  });

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function loadStoredBillers(): BillerSetup[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(BILLER_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is BillerSetup => {
      return (
        typeof item?.id === 'string' &&
        typeof item?.name === 'string' &&
        typeof item?.facility === 'string' &&
        typeof item?.frequency === 'string' &&
        typeof item?.dueDate === 'string'
      );
    });
  } catch {
    return [];
  }
}

export default function BillReminderPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const snapshot = useMemo(
    () => buildBillReminderSnapshot(applications),
    [applications],
  );

  const [billers, setBillers] = useState<BillerSetup[]>(() => loadStoredBillers());
  const [editingBillerId, setEditingBillerId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [facility, setFacility] = useState('');
  const [frequency, setFrequency] = useState<BillerFrequency>('Monthly');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(BILLER_STORAGE_KEY, JSON.stringify(billers));
  }, [billers]);

  const billerCards = useMemo(
    () =>
      [...billers]
        .map((biller) => ({
          ...biller,
          status: getBillerStatus(biller.dueDate),
        }))
        .sort((left, right) => {
          const leftDays = Number.isNaN(left.status.daysUntil) ? Number.POSITIVE_INFINITY : left.status.daysUntil;
          const rightDays = Number.isNaN(right.status.daysUntil) ? Number.POSITIVE_INFINITY : right.status.daysUntil;
          return leftDays - rightDays;
        }),
    [billers],
  );

  const billsPaymentHealthScore = useMemo(
    () => buildBillsPaymentHealthScore(billers),
    [billers],
  );

  const dueSoonCount = useMemo(
    () => billerCards.filter((biller) => biller.status.id === 'watch').length,
    [billerCards],
  );
  const pastDueCount = useMemo(
    () => billerCards.filter((biller) => biller.status.id === 'attention').length,
    [billerCards],
  );
  const reminderCount = useMemo(
    () => billerCards.filter((biller) => biller.status.id === 'maintain').length,
    [billerCards],
  );

  const advisor = useMemo(() => {
    const overdueBillers = billerCards.filter((biller) => biller.status.id === 'attention');
    const dueSoonBillers = billerCards.filter((biller) => biller.status.id === 'watch');
    const readyToPay = snapshot.readyToPayCount > 0;

    return {
      nextPriority: overdueBillers.length
        ? `Pay ${overdueBillers[0]?.name} first because it is already past due.`
        : dueSoonBillers.length
          ? `Prepare payment for ${dueSoonBillers[0]?.name}; it is due within 5 days.`
          : 'No immediate bill is due. Maintain your reminder list and keep funds allocated for the next cycle.',
      cashflowReminder: readyToPay
        ? 'Cashflow reminder: your current borrower profile shows payment room, so keep bill funding ring-fenced before discretionary spend.'
        : 'Cashflow reminder: tighten discretionary spending and reserve cash for the nearest due bills first.',
      coverageReminder: billers.length
        ? `Coverage reminder: ${billers.length} biller(s) tracked. Review frequencies and due dates regularly so reminder accuracy stays high.`
        : 'Coverage reminder: add your first biller so the page can begin monitoring upcoming due dates and overdue items.',
    };
  }, [billerCards, billers.length, snapshot.readyToPayCount]);

  const billingSummaryRows = useMemo(
    () =>
      billerCards.map((biller) => ({
        id: biller.id,
        name: biller.name,
        facility: biller.facility,
        frequency: biller.frequency,
        dueDateLabel: Number.isNaN(new Date(biller.dueDate).getTime())
          ? 'Not set'
          : new Date(biller.dueDate).toLocaleDateString(),
        daysLabel:
          Number.isNaN(biller.status.daysUntil)
            ? 'Needs update'
            : biller.status.daysUntil < 0
              ? `${Math.abs(biller.status.daysUntil)} day(s) overdue`
              : `${biller.status.daysUntil} day(s) remaining`,
        statusLabel: biller.status.label,
        status: biller.status.id,
      })),
    [billerCards],
  );

  const personalReminderCards = useMemo(
    () => [
      {
        id: 'due-soon',
        label: 'Bills Due Within 5 Days',
        value: dueSoonCount,
        helper: dueSoonCount > 0 ? 'Prepare payment or set aside funds now.' : 'No immediate bills due within 5 days.',
        status: dueSoonCount > 0 ? 'watch' : 'maintain',
      },
      {
        id: 'past-due',
        label: 'Past Due Bills',
        value: pastDueCount,
        helper: pastDueCount > 0 ? 'Settle overdue bills first to avoid compounding charges.' : 'No bill is currently past due.',
        status: pastDueCount > 0 ? 'attention' : 'maintain',
      },
      {
        id: 'payment-room',
        label: 'Payment Room',
        value: snapshot.readyToPayCount,
        helper: snapshot.readyToPayCount > 0
          ? 'Borrower profile shows room to fund near-term obligations.'
          : 'Cashflow room looks tight; prioritize essentials first.',
        status: snapshot.readyToPayCount > 0 ? 'maintain' : 'watch',
      },
      {
        id: 'biller-coverage',
        label: 'Biller Coverage',
        value: billers.length,
        helper: billers.length > 0 ? 'Tracked billers with stored due dates and frequency.' : 'Add billers so reminders can start working for you.',
        status: billers.length > 0 ? 'watch' : 'attention',
      },
    ],
    [dueSoonCount, pastDueCount, snapshot.readyToPayCount, billers.length],
  );

  const resetForm = () => {
    setEditingBillerId(null);
    setName('');
    setFacility('');
    setFrequency('Monthly');
    setDueDate('');
  };

  const handleAddBiller = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !facility.trim() || !dueDate) {
      return;
    }

    if (editingBillerId) {
      setBillers((previous) =>
        previous.map((biller) =>
          biller.id === editingBillerId
            ? {
                ...biller,
                name: name.trim(),
                facility: facility.trim(),
                frequency,
                dueDate,
              }
            : biller,
        ),
      );
      resetForm();
      return;
    }

    setBillers((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${previous.length + 1}`,
        name: name.trim(),
        facility: facility.trim(),
        frequency,
        dueDate,
      },
    ]);

    resetForm();
  };

  return (
    <div className="psychometric-page bill-reminder-dashboard-page">
      <section className="psychometric-hero bill-reminder-dashboard-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">Payment Calendar</span>
          <h1>Bill Reminder</h1>
          <p>
            Period: <strong>{snapshot.periodLabel}</strong> | Date: <strong>{snapshot.dateLabel}</strong>
          </p>
          <p>
            Built for individual bill tracking with borrower cashflow context, due-date reminders,
            and payment-readiness indicators.
          </p>
        </div>

        <div className="psychometric-hero-metric bill-reminder-dashboard-scorecard">
          <span>Bills Payment Health Score</span>
          <strong>{billsPaymentHealthScore.toFixed(1)}</strong>
          <small>{billerCards.length ? snapshot.performanceBand : 'Set up your first biller'}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Billings Monitored</span>
          <strong>{billers.length}</strong>
          <small>Total billers currently tracked for reminders</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Ready to Pay</span>
          <strong>{snapshot.readyToPayCount}</strong>
          <small>Accounts with usable surplus before due obligations</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Watchlist</span>
          <strong>{dueSoonCount + pastDueCount}</strong>
          <small>Billers due soon or already past due</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Performance Band</span>
          <strong>{snapshot.performanceBand}</strong>
          <small>{snapshot.healthScore} / 100 weighted score</small>
        </article>
      </section>

      <section className="psychometric-panel">
        <div className="psychometric-panel-header">
          <div>
            <span className="psychometric-panel-kicker">Billing Set Up Menu</span>
            <h2>Add and maintain billers with due dates</h2>
          </div>
        </div>

        <form className="budget-dashboard-form-grid" onSubmit={handleAddBiller}>
          <label className="budget-dashboard-category-input-wrap">
            <span className="budget-dashboard-category-input-label">Name of Biller</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="budget-dashboard-category-input"
              placeholder="Electric Company"
              required
            />
          </label>

          <label className="budget-dashboard-category-input-wrap">
            <span className="budget-dashboard-category-input-label">Facility / Utility Used</span>
            <input
              value={facility}
              onChange={(event) => setFacility(event.target.value)}
              className="budget-dashboard-category-input"
              placeholder="Electricity"
              required
            />
          </label>

          <label className="budget-dashboard-category-input-wrap">
            <span className="budget-dashboard-category-input-label">Frequency</span>
            <select
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as BillerFrequency)}
              className="budget-dashboard-category-input"
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Semi-Annual">Semi-Annual</option>
              <option value="Annual">Annual</option>
              <option value="Weekly">Weekly</option>
            </select>
          </label>

          <label className="budget-dashboard-category-input-wrap">
            <span className="budget-dashboard-category-input-label">Due Date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="budget-dashboard-category-input"
              required
            />
          </label>

          <div className="budget-dashboard-form-actions">
            <button type="submit" className="psychometric-reset-button">
              {editingBillerId ? 'Update Biller' : 'Save Biller'}
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
      </section>

      <section className="budget-dashboard-layout">
        <div className="budget-dashboard-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Billers Setup</span>
                <h2>Due-date reminder boxes</h2>
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

            <div className="budget-dashboard-card-grid">
              {billerCards.map((biller) => (
                <article key={biller.id} className={`budget-dashboard-card budget-dashboard-status-${biller.status.id}`}>
                  <div className="budget-dashboard-card-header">
                    <span>{biller.name}</span>
                    <div className="budget-dashboard-category-actions">
                      <strong>{biller.status.label}</strong>
                      <button
                        type="button"
                        className="budget-dashboard-category-reset"
                        onClick={() => {
                          setEditingBillerId(biller.id);
                          setName(biller.name);
                          setFacility(biller.facility);
                          setFrequency(biller.frequency);
                          setDueDate(biller.dueDate);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="budget-dashboard-category-reset"
                        onClick={() => {
                          setBillers((previous) => previous.filter((item) => item.id !== biller.id));
                          if (editingBillerId === biller.id) {
                            resetForm();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="budget-dashboard-comparison-values">
                    <div>
                      <small>Facility</small>
                      <strong>{biller.facility}</strong>
                    </div>
                    <div>
                      <small>Frequency</small>
                      <strong>{biller.frequency}</strong>
                    </div>
                  </div>
                  <div className="budget-dashboard-comparison-values">
                    <div>
                      <small>Due Date</small>
                      <strong>{new Date(biller.dueDate).toLocaleDateString()}</strong>
                    </div>
                    <div>
                      <small>Status</small>
                      <strong>{biller.status.note}</strong>
                    </div>
                  </div>
                </article>
              ))}
              {billerCards.length === 0 ? (
                <article className="budget-dashboard-card budget-dashboard-status-watch">
                  <div className="budget-dashboard-card-header">
                    <span>No billers yet</span>
                    <strong>Set Up Needed</strong>
                  </div>
                  <p>Add your first biller above to start receiving due-date reminder boxes.</p>
                </article>
              ) : null}
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Billing Calendar Summary</span>
                <h2>Helpful view for personally monitored billings</h2>
              </div>
            </div>

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>Name of Biller</th>
                    <th>Facility / Utility Used</th>
                    <th>Frequency</th>
                    <th>Due Date</th>
                    <th>Days to Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billingSummaryRows.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Name of Biller">{row.name}</td>
                      <td data-label="Facility / Utility Used">{row.facility}</td>
                      <td data-label="Frequency">{row.frequency}</td>
                      <td data-label="Due Date">{row.dueDateLabel}</td>
                      <td data-label="Days to Due">{row.daysLabel}</td>
                      <td data-label="Status">{row.statusLabel}</td>
                    </tr>
                  ))}
                  {billingSummaryRows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No billers are set up yet. Add a biller above to start tracking due dates.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="budget-dashboard-comparison-grid">
              {personalReminderCards.map((card) => (
                <article key={card.id} className={`budget-dashboard-comparison-card budget-dashboard-status-${card.status}`}>
                  <div className="budget-dashboard-card-header">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </div>
                  <p>{card.helper}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Personal Reminder Guidance</span>
                <h2>Helpful guidance for individual billing monitoring</h2>
              </div>
            </div>

            <div className="budget-dashboard-indicator-row">
              <article className={`budget-dashboard-indicator budget-dashboard-status-${pastDueCount > 0 ? 'attention' : 'maintain'}`}>
                <span>Pay Overdue Bills First</span>
                <strong>{pastDueCount > 0 ? 'High Priority' : 'Clear'}</strong>
                <p>
                  {pastDueCount > 0
                    ? 'Overdue bills should be paid before lower-priority upcoming bills to avoid additional fees and service interruption.'
                    : 'No overdue bill is currently flagged, so keep upcoming due dates funded and tracked.'}
                </p>
              </article>

              <article className={`budget-dashboard-indicator budget-dashboard-status-${dueSoonCount > 0 ? 'watch' : 'maintain'}`}>
                <span>Prepare the Next 5 Days</span>
                <strong>{dueSoonCount > 0 ? 'Due Soon' : 'Stable'}</strong>
                <p>
                  {dueSoonCount > 0
                    ? 'Bills due within five days should be funded now so you are not forced into last-minute catch-up payments.'
                    : 'There are no near-term due bills inside the next five days right now.'}
                </p>
              </article>

              <article className={`budget-dashboard-indicator budget-dashboard-status-${snapshot.readyToPayCount > 0 ? 'maintain' : 'watch'}`}>
                <span>Use Borrower Cashflow Signal</span>
                <strong>{snapshot.readyToPayCount > 0 ? 'Payment Room' : 'Conserve Cash'}</strong>
                <p>
                  {snapshot.readyToPayCount > 0
                    ? 'The borrower profile suggests some payment room, so reserve it first for required bills before discretionary spending.'
                    : 'Current financial pressure looks tighter, so prioritize essential utilities and fixed obligations first.'}
                </p>
              </article>
            </div>
          </article>

          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">AI Reminder</span>
                <h2>Suggested next actions from the current bill list</h2>
              </div>
            </div>

            <div className="budget-dashboard-indicator-row">
              <article className={`budget-dashboard-indicator ${pastDueCount > 0 ? 'budget-dashboard-status-attention' : 'budget-dashboard-status-maintain'}`}>
                <span>Next Priority</span>
                <strong>{pastDueCount > 0 ? 'Act Now' : dueSoonCount > 0 ? 'Prepare Now' : 'Stable'}</strong>
                <p>{advisor.nextPriority}</p>
              </article>

              <article className={`budget-dashboard-indicator ${snapshot.readyToPayCount > 0 ? 'budget-dashboard-status-maintain' : 'budget-dashboard-status-watch'}`}>
                <span>Cashflow Reminder</span>
                <strong>{snapshot.readyToPayCount > 0 ? 'Payment Room Available' : 'Tighten Spend'}</strong>
                <p>{advisor.cashflowReminder}</p>
              </article>

              <article className={`budget-dashboard-indicator ${billers.length > 0 ? 'budget-dashboard-status-watch' : 'budget-dashboard-status-attention'}`}>
                <span>Coverage Reminder</span>
                <strong>{billers.length > 0 ? 'Review Setup' : 'Add Billers'}</strong>
                <p>{advisor.coverageReminder}</p>
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
                <span>Reminder</span>
                <strong>{reminderCount}</strong>
              </li>
              <li>
                <span>Due within 5 days</span>
                <strong>{dueSoonCount}</strong>
              </li>
              <li>
                <span>Past due</span>
                <strong>{pastDueCount}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Queue Health</span>
            <h2>{snapshot.performanceBand}</h2>
            <ul className="psychometric-breakdown-list">
              <li>
                <span>Billings monitored</span>
                <strong>{billers.length}</strong>
              </li>
              <li>
                <span>Ready to pay</span>
                <strong>{snapshot.readyToPayCount}</strong>
              </li>
              <li>
                <span>Average surplus ratio</span>
                <strong>{formatPercent(snapshot.averageSurplusRatio)}</strong>
              </li>
            </ul>
          </article>

          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Reminder Notes</span>
            <h2>Best-practice focus</h2>
            <p className="psychometric-section-note">
              Green reminder cards are safe, yellow cards are due within 5 days, and red cards are past due.
              Use the setup menu to keep due dates and billing frequency current.
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}

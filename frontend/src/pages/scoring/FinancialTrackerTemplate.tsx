import { useMemo, useState } from 'react';

export type TrackerItem = {
  id: string;
  label: string;
  target: number;
  initialValue: number;
  note: string;
};

type FinancialTrackerTemplateProps = {
  eyebrow: string;
  title: string;
  description: string;
  metricLabel: string;
  itemLabel: string;
  targetLabel: string;
  valuePrefix?: string;
  valueSuffix?: string;
  items: TrackerItem[];
  isLoading?: boolean;
  errorMessage?: string;
  sourceNote?: string;
  onRefresh?: () => void;
};

function getPerformanceBand(score: number) {
  if (score >= 90) {
    return 'Excellent';
  }

  if (score >= 75) {
    return 'Strong';
  }

  if (score >= 60) {
    return 'Stable';
  }

  if (score >= 45) {
    return 'Watchlist';
  }

  return 'Needs Attention';
}

function clamp(numberValue: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, numberValue));
}

function formatMetricValue(value: number, prefix = '', suffix = '') {
  const rounded = Math.round(value);
  return `${prefix}${rounded.toLocaleString()}${suffix}`;
}

export default function FinancialTrackerTemplate({
  eyebrow,
  title,
  description,
  metricLabel,
  itemLabel,
  targetLabel,
  valuePrefix = '',
  valueSuffix = '',
  items,
  isLoading = false,
  errorMessage = '',
  sourceNote,
  onRefresh,
}: FinancialTrackerTemplateProps) {
  const [values, setValues] = useState<Record<string, number>>(
    () =>
      items.reduce<Record<string, number>>((accumulator, item) => {
        accumulator[item.id] = item.initialValue;
        return accumulator;
      }, {}),
  );

  const itemSummaries = useMemo(
    () =>
      items.map((item) => {
        const currentValue = values[item.id] ?? 0;
        const attainment = clamp((currentValue / item.target) * 100, 0, 100);

        return {
          ...item,
          currentValue,
          attainment,
        };
      }),
    [items, values],
  );

  const averageAttainment = useMemo(() => {
    if (!itemSummaries.length) {
      return 0;
    }

    const totalAttainment = itemSummaries.reduce((sum, item) => sum + item.attainment, 0);
    return totalAttainment / itemSummaries.length;
  }, [itemSummaries]);

  const completedItems = itemSummaries.filter((item) => item.attainment >= 100).length;
  const watchlistItems = itemSummaries.filter((item) => item.attainment < 70).length;
  const performanceBand = getPerformanceBand(averageAttainment);

  const ringDegrees = clamp((averageAttainment / 100) * 360, 0, 360);
  const scoreRingStyle = {
    background: `
      radial-gradient(circle at center, #fffef7 0 54%, transparent 55%),
      conic-gradient(#0f766e 0deg ${ringDegrees}deg, rgba(226, 232, 240, 0.9) ${ringDegrees}deg 360deg)
    `,
  };

  const handleValueChange = (itemId: string, value: number) => {
    setValues((previous) => ({
      ...previous,
      [itemId]: value,
    }));
  };

  const handleReset = () => {
    setValues(
      items.reduce<Record<string, number>>((accumulator, item) => {
        accumulator[item.id] = item.initialValue;
        return accumulator;
      }, {}),
    );
  };

  return (
    <div className="psychometric-page">
      <section className="psychometric-hero">
        <div className="psychometric-hero-copy">
          <span className="psychometric-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="psychometric-hero-metric">
          <span>{metricLabel}</span>
          <strong>{averageAttainment.toFixed(1)}</strong>
          <small>{performanceBand}</small>
        </div>
      </section>

      <section className="psychometric-summary-grid">
        <article className="psychometric-summary-card psychometric-summary-card-highlight">
          <span>Tracked Areas</span>
          <strong>{itemSummaries.length}</strong>
          <small>Active monitoring points</small>
        </article>

        <article className="psychometric-summary-card">
          <span>On Target</span>
          <strong>{completedItems}</strong>
          <small>At or above goal</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Watchlist</span>
          <strong>{watchlistItems}</strong>
          <small>Below 70% attainment</small>
        </article>

        <article className="psychometric-summary-card">
          <span>Performance Band</span>
          <strong>{performanceBand}</strong>
          <small>{averageAttainment.toFixed(0)} / 100 weighted score</small>
        </article>
      </section>

      <section className="psychometric-layout">
        <div className="psychometric-main">
          <article className="psychometric-panel">
            <div className="psychometric-panel-header">
              <div>
                <span className="psychometric-panel-kicker">Tracker Controls</span>
                <h2>Adjust live values against each target</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onRefresh ? (
                  <button
                    type="button"
                    className="psychometric-reset-button"
                    onClick={onRefresh}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Refreshing...' : 'Refresh Data'}
                  </button>
                ) : null}
                <button type="button" className="psychometric-reset-button" onClick={handleReset}>
                  Reset Values
                </button>
              </div>
            </div>

            {errorMessage ? (
              <p className="psychometric-section-note" role="alert">
                {errorMessage}
              </p>
            ) : null}

            {sourceNote ? (
              <p className="psychometric-section-note">{sourceNote}</p>
            ) : null}

            <div className="psychometric-scale-table-wrap">
              <table className="psychometric-scale-table">
                <thead>
                  <tr>
                    <th>{itemLabel}</th>
                    <th>Current</th>
                    <th>{targetLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {itemSummaries.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{formatMetricValue(item.currentValue, valuePrefix, valueSuffix)}</td>
                      <td>{formatMetricValue(item.target, valuePrefix, valueSuffix)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="psychometric-sections">
            {itemSummaries.map((item) => (
              <article key={item.id} className="psychometric-section-card">
                <div className="psychometric-section-header">
                  <div>
                    <span className="psychometric-section-code">Metric {item.id.toUpperCase()}</span>
                    <h3>{item.label}</h3>
                    <p>{item.note}</p>
                  </div>

                  <div className="psychometric-section-score">
                    <strong>{item.attainment.toFixed(0)}%</strong>
                    <span>target attainment</span>
                  </div>
                </div>

                <div className="psychometric-progress-track" aria-hidden="true">
                  <div className="psychometric-progress-bar" style={{ width: `${item.attainment}%` }} />
                </div>

                <div className="psychometric-formula-grid">
                  <div className="psychometric-formula-card">
                    <span>Current</span>
                    <strong>{formatMetricValue(item.currentValue, valuePrefix, valueSuffix)}</strong>
                  </div>
                  <div className="psychometric-formula-card">
                    <span>Target</span>
                    <strong>{formatMetricValue(item.target, valuePrefix, valueSuffix)}</strong>
                  </div>
                  <div className="psychometric-formula-card psychometric-formula-card-accent">
                    <span>Live Adjustment</span>
                    <strong>
                      <input
                        type="range"
                        min={0}
                        max={item.target * 1.5}
                        step={1}
                        value={item.currentValue}
                        onChange={(event) => handleValueChange(item.id, Number(event.target.value))}
                        style={{ width: '100%' }}
                        aria-label={`Adjust ${item.label}`}
                      />
                    </strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="psychometric-side-panel">
          <article className="psychometric-panel psychometric-sticky-panel">
            <span className="psychometric-panel-kicker">Overall Computation</span>
            <h2>Live score snapshot</h2>

            <div className="psychometric-score-ring" style={scoreRingStyle}>
              <strong>{averageAttainment.toFixed(1)}</strong>
              <span>/ 100</span>
            </div>

            <ul className="psychometric-breakdown-list">
              <li>
                <span>Average attainment</span>
                <strong>{averageAttainment.toFixed(1)}</strong>
              </li>
              <li>
                <span>Performance band</span>
                <strong>{performanceBand}</strong>
              </li>
              <li>
                <span>On-target areas</span>
                <strong>{completedItems}</strong>
              </li>
              <li>
                <span>Watchlist areas</span>
                <strong>{watchlistItems}</strong>
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  );
}

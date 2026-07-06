import { useMemo } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import FinancialTrackerTemplate from './FinancialTrackerTemplate';
import { buildNetWorthPositioningItems } from './liveTrackerMetrics';

export default function NetWorthPositioningPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const netWorthItems = useMemo(
    () => buildNetWorthPositioningItems(applications),
    [applications],
  );

  return (
    <FinancialTrackerTemplate
      eyebrow="Balance Sheet Positioning"
      title="Net Worth Positioning"
      description="Live positioning signals from valuation cushions, debt compression, liquidity surplus, and portfolio stability trends."
      metricLabel="Net Worth Position Score"
      itemLabel="Positioning Indicator"
      targetLabel="Target Value"
      valueSuffix="%"
      items={netWorthItems}
      isLoading={loading}
      errorMessage={error}
      sourceNote={lastUpdated ? `Data source: Loan Repository • Updated ${lastUpdated.toLocaleString()}` : 'Data source: Loan Repository'}
      onRefresh={reload}
    />
  );
}

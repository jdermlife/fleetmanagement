import { useMemo } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import FinancialTrackerTemplate from './FinancialTrackerTemplate';
import { buildCollateralMonitoringItems } from './liveTrackerMetrics';

export default function CollateralMonitoringPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const collateralItems = useMemo(
    () => buildCollateralMonitoringItems(applications),
    [applications],
  );

  return (
    <FinancialTrackerTemplate
      eyebrow="Collateral Governance"
      title="Collateral Monitoring"
      description="Live collateral controls based on LTV, insurance, marketability, and recorded collateral-score signals."
      metricLabel="Collateral Integrity Score"
      itemLabel="Collateral Control"
      targetLabel="Target Compliance"
      valueSuffix="%"
      items={collateralItems}
      isLoading={loading}
      errorMessage={error}
      sourceNote={lastUpdated ? `Data source: Loan Repository • Updated ${lastUpdated.toLocaleString()}` : 'Data source: Loan Repository'}
      onRefresh={reload}
    />
  );
}

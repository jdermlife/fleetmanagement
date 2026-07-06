import { useMemo } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import FinancialTrackerTemplate from './FinancialTrackerTemplate';
import { buildLoanMonitoringItems } from './liveTrackerMetrics';

export default function LoanMonitoringPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const loanMonitoringItems = useMemo(
    () => buildLoanMonitoringItems(applications),
    [applications],
  );

  return (
    <FinancialTrackerTemplate
      eyebrow="Loan Performance Oversight"
      title="Loan Monitoring"
      description="Live monitoring sourced from loan statuses, DTI, DSR, and repayment-flow indicators in the Loan Repository."
      metricLabel="Repayment Stability Score"
      itemLabel="Monitoring Indicator"
      targetLabel="Target Attainment"
      valueSuffix="%"
      items={loanMonitoringItems}
      isLoading={loading}
      errorMessage={error}
      sourceNote={lastUpdated ? `Data source: Loan Repository • Updated ${lastUpdated.toLocaleString()}` : 'Data source: Loan Repository'}
      onRefresh={reload}
    />
  );
}

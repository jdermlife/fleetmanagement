import { useMemo } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import FinancialTrackerTemplate from './FinancialTrackerTemplate';
import { buildBillReminderItems } from './liveTrackerMetrics';

export default function BillReminderPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const billReminderItems = useMemo(
    () => buildBillReminderItems(applications),
    [applications],
  );

  return (
    <FinancialTrackerTemplate
      eyebrow="Payment Calendar"
      title="Bill Reminder"
      description="Live billing-readiness indicators built from loan obligations, repayment pressure, and processing outcomes."
      metricLabel="Due-Date Compliance Score"
      itemLabel="Reminder Category"
      targetLabel="Monthly Target"
      valueSuffix="%"
      items={billReminderItems}
      isLoading={loading}
      errorMessage={error}
      sourceNote={lastUpdated ? `Data source: Loan Repository • Updated ${lastUpdated.toLocaleString()}` : 'Data source: Loan Repository'}
      onRefresh={reload}
    />
  );
}

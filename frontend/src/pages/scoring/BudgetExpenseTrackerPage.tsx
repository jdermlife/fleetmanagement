import { useMemo } from 'react';

import { useLoanApplicationsMetrics } from '../../hooks/useLoanApplicationsMetrics';
import FinancialTrackerTemplate from './FinancialTrackerTemplate';
import { buildBudgetExpenseTrackerItems } from './liveTrackerMetrics';

export default function BudgetExpenseTrackerPage() {
  const { applications, error, lastUpdated, loading, reload } = useLoanApplicationsMetrics();
  const budgetItems = useMemo(
    () => buildBudgetExpenseTrackerItems(applications),
    [applications],
  );

  return (
    <FinancialTrackerTemplate
      eyebrow="Household Financial Controls"
      title="Budget and Expense Tracker"
      description="Live metrics derived from borrower income, obligations, and recorded household expenses using the Psychometric-style visual dashboard."
      metricLabel="Budget Health Score"
      itemLabel="Budget Line"
      targetLabel="Budget Target"
      valueSuffix="%"
      items={budgetItems}
      isLoading={loading}
      errorMessage={error}
      sourceNote={lastUpdated ? `Data source: Loan Repository • Updated ${lastUpdated.toLocaleString()}` : 'Data source: Loan Repository'}
      onRefresh={reload}
    />
  );
}

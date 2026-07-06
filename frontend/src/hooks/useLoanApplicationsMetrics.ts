import { useCallback, useEffect, useState } from 'react';

import { getErrorMessage } from '../api';
import { fetchAllLoanApplications, type LoanApplicationRecord } from '../api/loan';

const DEFAULT_MAX_RECORDS = 300;

export function useLoanApplicationsMetrics(maxRecords = DEFAULT_MAX_RECORDS) {
  const [applications, setApplications] = useState<LoanApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const records = await fetchAllLoanApplications({ maxRecords });
      setApplications(records);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load live loan data.'));
    } finally {
      setLoading(false);
    }
  }, [maxRecords]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    applications,
    error,
    lastUpdated,
    loading,
    reload: load,
  };
}

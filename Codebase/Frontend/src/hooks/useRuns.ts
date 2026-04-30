import { useCallback, useEffect, useState } from 'react';
import { fetchRuns } from '../api/client';
import { RunListItem } from '../types/api';

interface UseRunsResult {
  runs: RunListItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRuns(autoLoad = true): UseRunsResult {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchRuns();
      setRuns(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) void refresh();
  }, [autoLoad, refresh]);

  return { runs, loading, error, refresh };
}

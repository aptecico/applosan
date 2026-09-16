import { useCallback, useEffect, useState } from 'react';

import { getOpenCashSession } from '@/services/backend';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import type { CashSession } from '@/types/commerce';

export function useOpenCashSession() {
  const { branch } = useWorkspace();
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await getOpenCashSession(branch?.id));
      setError('');
    } catch (caught) {
      setSession(null);
      setError(caught instanceof Error ? caught.message : 'No se pudo consultar la caja.');
    } finally {
      setLoading(false);
    }
  }, [branch?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    session,
    isOpen: session?.status === 'open',
    loading,
    error,
    refresh,
  };
}

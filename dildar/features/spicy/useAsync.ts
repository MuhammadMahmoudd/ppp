import { useCallback, useEffect, useRef, useState } from 'react';

/** Tiny loader with loading/error/reload for spicy screens. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const v = await fn();
      if (id === seq.current) setData(v);
    } catch (e) {
      if (id === seq.current) setError(e);
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, setData, error, loading, reload };
}

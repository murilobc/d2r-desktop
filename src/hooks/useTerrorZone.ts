import { useEffect, useState } from "react";
import type { TerrorZoneInfo } from "../types";
import { getTzCache, getSpTerrorZone } from "../api";

interface UseTerrorZoneResult {
  tzInfo: TerrorZoneInfo | null;
  loading: boolean;
  error: string | null;
}

/**
 * Reads the current Terror Zone from the SQLite cache.
 * Falls back to the deterministic SP calculator if the cache is empty.
 * Does NOT drive any polling — TerrorZone.tsx owns polling.
 */
export function useTerrorZone(): UseTerrorZoneResult {
  const [tzInfo, setTzInfo] = useState<TerrorZoneInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const cached = await getTzCache();
        if (!cancelled) {
          if (cached) {
            setTzInfo(cached);
          } else {
            // Fall back to SP calculation
            const sp = await getSpTerrorZone(Date.now() / 1000);
            if (!cancelled) setTzInfo(sp);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setTzInfo(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { tzInfo, loading, error };
}

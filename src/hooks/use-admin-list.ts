"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { authedFetch } from "@/lib/firebase/authed-fetch";

/**
 * Shared "load a list for an admin panel" hook. `email` kept purely as a
 * caller-side display/cache-key convenience — authentication itself comes
 * from authedFetch's Firebase token, not this value.
 */
export function useAdminList<T>(endpoint: string, email: string, dataKey: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch(endpoint);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحميل");
      setData(json[dataKey] || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, [endpoint, email, dataKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { data, setData, loading, reload: load };
}

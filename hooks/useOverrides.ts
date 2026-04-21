"use client";

import { useCallback, useEffect, useState } from "react";
import type { TimetableOverride } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * 時間割例外（休講/差し替え/追加）を取得・保存する Hook。
 */
export function useOverrides() {
  const [overrides, setOverridesState] = useState<TimetableOverride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.getOverrides().then((o) => {
      if (!cancelled) {
        setOverridesState(o);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: TimetableOverride[]) => {
    await localDataSource.saveOverrides(next);
    setOverridesState(next);
  }, []);

  return { overrides, loading, save };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * 現年度ポインタを取得・更新する Hook。
 * 初回マウント時に localStorage から読み込む（SSR 中は null）。
 */
export function useCurrentYear() {
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.getCurrentYear().then((y) => {
      if (!cancelled) {
        setYear(y);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateYear = useCallback(async (next: number) => {
    await localDataSource.setCurrentYear(next);
    setYear(next);
  }, []);

  return { year, loading, setYear: updateYear };
}

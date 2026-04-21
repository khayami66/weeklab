"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArchivedWeek, ArchiveMetadata } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * アーカイブの年度一覧を取得する Hook。
 * 特定年度の週データ読み取りは `fetchWeeks(year)` で明示的に取る。
 */
export function useArchive() {
  const [years, setYears] = useState<ArchiveMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await localDataSource.listArchivedYears();
    setYears(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    localDataSource.listArchivedYears().then((list) => {
      if (!cancelled) {
        setYears(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchWeeks = useCallback(async (year: number): Promise<ArchivedWeek[]> => {
    return localDataSource.getArchivedWeeks(year);
  }, []);

  return { years, loading, fetchWeeks, reload };
}

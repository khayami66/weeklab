"use client";

import { useCallback, useEffect, useState } from "react";
import { localDataSource } from "@/lib/datasource/localDataSource";
import { memoKey } from "@/lib/store/localStore";

/**
 * 特定コマのメモ（日付×クラス×時限）を取得・保存する Hook。
 * キーは `weeklab.{year}.memo.{date}.{class_code}.{period}` を使用。
 */
export function useLessonMemo(
  year: number | null,
  date: string,
  classCode: string,
  period: number
) {
  const [memo, setMemoState] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fullKey = year !== null ? memoKey(year, date, classCode, period) : null;

  useEffect(() => {
    let cancelled = false;
    if (fullKey === null) {
      setLoading(false);
      return;
    }
    localDataSource.getMemo(fullKey).then((m) => {
      if (!cancelled) {
        setMemoState(m ?? "");
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fullKey]);

  const save = useCallback(
    async (next: string) => {
      if (fullKey === null) return;
      await localDataSource.saveMemo(fullKey, next);
      setMemoState(next);
    },
    [fullKey]
  );

  return { memo, loading, save };
}

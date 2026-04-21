"use client";

import { useCallback, useEffect, useState } from "react";
import type { FirstLessonConfirm } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * 指定週（月曜日）の「週先頭コマ確定」値を取得・保存する Hook。
 * 壁打ち合意事項C：新年度に引き継がない（年度プレフィックスで自然分離）。
 */
export function useFirstLessonConfirms(mondayDate: string | null) {
  const [confirms, setConfirmsState] = useState<FirstLessonConfirm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (mondayDate === null) {
      setLoading(false);
      return;
    }
    localDataSource.getFirstLessonConfirms(mondayDate).then((c) => {
      if (!cancelled) {
        setConfirmsState(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mondayDate]);

  const save = useCallback(
    async (next: FirstLessonConfirm[]) => {
      if (mondayDate === null) return;
      await localDataSource.saveFirstLessonConfirms(mondayDate, next);
      setConfirmsState(next);
    },
    [mondayDate]
  );

  return { confirms, loading, save };
}

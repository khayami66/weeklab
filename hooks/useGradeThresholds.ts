"use client";

import { useCallback, useEffect, useState } from "react";
import type { GradeThreshold } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";
import { defaultThresholds } from "@/lib/grading";

/**
 * 評定（A/B/C）の閾値を取得・保存する Hook。
 *
 * 90/60 は**固定値ではなく初期値**。1回目の集計で A/B/C の分布を見てから
 * 根拠を持って調整できるよう、観点ごとに設定値として持たせている。
 */
export function useGradeThresholds() {
  const [thresholds, setThresholdsState] = useState<GradeThreshold[]>(defaultThresholds());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.getGradeThresholds().then((t) => {
      if (!cancelled) {
        setThresholdsState(t);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: GradeThreshold[]) => {
    await localDataSource.saveGradeThresholds(next);
    setThresholdsState(next);
  }, []);

  return { thresholds, loading, save };
}

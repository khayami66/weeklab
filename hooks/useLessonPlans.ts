"use client";

import { useCallback, useEffect, useState } from "react";
import type { LessonPlan } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * ユーザーが編集した授業案を取得・保存する Hook。
 *
 * 全単元ぶんをまとめて読む。1単元8時間 × 20単元 × 2学年でも数百件なので、
 * 量としては問題にならない（テスト得点と同じ考え方）。
 */
export function useLessonPlans() {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.getLessonPlans().then((p) => {
      if (!cancelled) {
        setPlans(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: LessonPlan[]) => {
    await localDataSource.saveLessonPlans(next);
    setPlans(next);
  }, []);

  return { plans, loading, save };
}

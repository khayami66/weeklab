"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClassProgress } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * クラス別進度を取得・保存する Hook。
 * 初回は TeacherSetting.grade_configs から動的生成される。
 */
export function useClassProgress() {
  const [progress, setProgressState] = useState<ClassProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.getClassProgress().then((p) => {
      if (!cancelled) {
        setProgressState(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: ClassProgress[]) => {
    await localDataSource.saveClassProgress(next);
    setProgressState(next);
  }, []);

  return { progress, loading, save };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeacherSetting } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * 教員個人設定を取得・保存する Hook。
 */
export function useSetting() {
  const [setting, setSettingState] = useState<TeacherSetting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.getSetting().then((s) => {
      if (!cancelled) {
        setSettingState(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: TeacherSetting) => {
    await localDataSource.saveSetting(next);
    setSettingState(next);
  }, []);

  return { setting, loading, save };
}

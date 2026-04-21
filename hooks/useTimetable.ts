"use client";

import { useCallback, useEffect, useState } from "react";
import type { Timetable } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * 基本時間割を取得・保存する Hook。
 * MVP 初期値は空配列。ユーザーが `/timetable` 画面で自校の時間割を入力する。
 */
export function useTimetable() {
  const [timetable, setTimetableState] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.getTimetable().then((t) => {
      if (!cancelled) {
        setTimetableState(t);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: Timetable[]) => {
    await localDataSource.saveTimetable(next);
    setTimetableState(next);
  }, []);

  return { timetable, loading, save };
}

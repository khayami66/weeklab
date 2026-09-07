"use client";

import { useCallback, useEffect, useState } from "react";
import type { SlotPlanOverride } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * コマの**中身**の差し替え（テスト・別単元の差し込み）を取得・保存する Hook。
 * コマの**有無**を変える `useOverrides` とは別物。
 */
export function useSlotPlans() {
  const [slotPlans, setSlotPlansState] = useState<SlotPlanOverride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.getSlotPlans().then((p) => {
      if (!cancelled) {
        setSlotPlansState(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: SlotPlanOverride[]) => {
    await localDataSource.saveSlotPlans(next);
    setSlotPlansState(next);
  }, []);

  return { slotPlans, loading, save };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { TestMaster } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * 業者単元テストの定義（満点など）を取得・保存する Hook。
 *
 * 採択は学校ごとのローカル事情なのでカリキュラムパックには含めず、
 * ユーザーが `/settings` 画面で登録する。初期値は空配列。
 */
export function useTestMasters() {
  const [testMasters, setTestMastersState] = useState<TestMaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.getTestMasters().then((m) => {
      if (!cancelled) {
        setTestMastersState(m);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: TestMaster[]) => {
    await localDataSource.saveTestMasters(next);
    setTestMastersState(next);
  }, []);

  return { testMasters, loading, save };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { TestResult } from "@/types";
import { localDataSource } from "@/lib/datasource/localDataSource";

/**
 * 現年度のテスト得点を取得・保存する Hook。
 *
 * 1クラス1テストで1レコード。全件まとめて読むのは、
 * 学期評定（G4）が期間内の全テストを横断して集計するため。
 * 7クラス × 十数テストなので量としては問題にならない。
 */
export function useTestResults() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localDataSource.listTestResults().then((r) => {
      if (!cancelled) {
        setResults(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 複数の TestResult をまとめて保存し、全件を読み直す */
  const saveMany = useCallback(async (next: TestResult[]) => {
    for (const r of next) {
      await localDataSource.saveTestResult(r);
    }
    const all = await localDataSource.listTestResults();
    setResults(all);
  }, []);

  return { results, loading, saveMany };
}

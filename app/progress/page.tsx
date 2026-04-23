"use client";

import { useEffect, useMemo, useState } from "react";
import ClassProgressRow from "@/components/ClassProgressRow";
import HealthBadge from "@/components/HealthBadge";
import PageHeader from "@/components/PageHeader";
import Toast from "@/components/Toast";
import { useClassProgress } from "@/hooks/useClassProgress";
import { useSetting } from "@/hooks/useSetting";
import { getWeekNumber } from "@/lib/date";
import { localDataSource } from "@/lib/datasource/localDataSource";
import { checkProgressHealth } from "@/lib/healthCheck";
import { advanceProgress } from "@/lib/progress";
import type { AnnualPlan, ClassProgress } from "@/types";
import { getActivePacks } from "@/types";

/**
 * 標準的な小学校の年間授業実施週数（概算）。
 * 学習指導要領では 35 週を標準とする。長期休業・行事等を除いた実質的な授業週。
 * 進度ヘルスチェックの期待累計算出に使用。
 */
const TOTAL_WEEKS = 35;

export default function ProgressPage() {
  const { setting, loading: settingLoading } = useSetting();
  const { progress, loading: progressLoading, save } = useClassProgress();

  const [draft, setDraft] = useState<ClassProgress[]>([]);
  const [annualPlanByPack, setAnnualPlanByPack] = useState<Record<string, AnnualPlan[]>>({});
  const [packsLoading, setPacksLoading] = useState(true);

  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "info" | "error">("success");
  const [saving, setSaving] = useState(false);

  // パック読み込み
  useEffect(() => {
    if (!setting) return;
    let cancelled = false;
    (async () => {
      const ids = getActivePacks(setting);
      const result: Record<string, AnnualPlan[]> = {};
      for (const id of ids) {
        result[id] = await localDataSource.getAnnualPlan(id);
      }
      if (!cancelled) {
        setAnnualPlanByPack(result);
        setPacksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setting]);

  // progress が読み込まれたら draft に同期
  useEffect(() => {
    if (!progressLoading && draft.length === 0 && progress.length > 0) {
      setDraft(structuredClone(progress));
    }
  }, [progress, progressLoading, draft.length]);

  // 現在の週番号
  const currentWeekNo = useMemo(() => {
    if (!setting) return 0;
    return getWeekNumber(new Date(), setting.start_date);
  }, [setting]);

  // ヘルスチェック（draft 基準で算出するので、編集中の結果が反映される）
  const healthByClass = useMemo(() => {
    if (!setting || draft.length === 0 || Object.keys(annualPlanByPack).length === 0) {
      return new Map<string, ReturnType<typeof checkProgressHealth>[number]>();
    }
    const healths = checkProgressHealth(draft, annualPlanByPack, currentWeekNo, TOTAL_WEEKS);
    return new Map(healths.map((h) => [h.class_code, h]));
  }, [draft, annualPlanByPack, currentWeekNo, setting]);

  const isDirty = useMemo(() => {
    return JSON.stringify(progress) !== JSON.stringify(draft);
  }, [progress, draft]);

  const loading = settingLoading || progressLoading || packsLoading;
  if (loading || !setting) {
    return (
      <div>
        <PageHeader title="進度管理" />
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  const handleRowChange = (index: number, next: ClassProgress) => {
    setDraft((prev) => {
      const updated = [...prev];
      updated[index] = next;
      return updated;
    });
  };

  const handleAdvance = (index: number) => {
    setDraft((prev) => {
      const updated = [...prev];
      const p = updated[index];
      const annualPlan = annualPlanByPack[p.pack_id] ?? [];
      updated[index] = advanceProgress(p, annualPlan);
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(draft);
      setToastKind("success");
      setToast("進度を保存しました");
    } catch (err) {
      setToastKind("error");
      setToast(`保存に失敗しました: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft(structuredClone(progress));
  };

  // サマリ（全クラスの ok/warn/alert 件数）
  const summary = { ok: 0, warn: 0, alert: 0 };
  for (const h of healthByClass.values()) {
    summary[h.level] += 1;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="進度管理（補正用）"
        subtitle={`第 ${currentWeekNo} 週時点での進捗状況（期待累計＝年間配当時数 × ${currentWeekNo}/${TOTAL_WEEKS}）`}
      />

      {/* 位置づけ案内バナー */}
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold">この画面は補正用です</p>
        <p className="mt-1 text-blue-700">
          通常の進度更新は <b>週案画面の「今週を実施済みに確定」ボタン</b>（Phase 12 実装予定）で自動反映されます。
          校外学習・出張・単元の前後入れ替えなど、<b>イレギュラーな補正が必要な場合のみ</b>こちらで直接編集してください。
        </p>
      </section>

      {/* 全体サマリ */}
      {draft.length > 0 && (
        <section className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <span className="text-slate-500">サマリ：</span>
          <span className="rounded bg-emerald-50 px-3 py-1 text-emerald-700">
            順調 {summary.ok}
          </span>
          <span className="rounded bg-amber-50 px-3 py-1 text-amber-700">
            注意 {summary.warn}
          </span>
          <span className="rounded bg-rose-50 px-3 py-1 text-rose-700">
            要対応 {summary.alert}
          </span>
        </section>
      )}

      {/* クラス一覧 */}
      {draft.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          クラスが登録されていません。設定画面で学年構成を登録してください。
        </section>
      ) : (
        <section className="space-y-3">
          {draft.map((p, index) => (
            <ClassProgressRow
              key={p.class_code}
              progress={p}
              annualPlan={annualPlanByPack[p.pack_id] ?? []}
              health={healthByClass.get(p.class_code)}
              onChange={(next) => handleRowChange(index, next)}
              onAdvance={() => handleAdvance(index)}
            />
          ))}
        </section>
      )}

      {/* 保存ボタン（sticky footer） */}
      {draft.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            変更を取り消し
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500">
        ※ ヘルスチェック閾値：差 3h 未満＝順調、3〜5h＝注意、5h以上＝要対応。
        標準授業週数 {TOTAL_WEEKS} 週を基準に期待累計を算出しています。
      </p>

      <Toast message={toast} kind={toastKind} onDismiss={() => setToast(null)} />
    </div>
  );
}

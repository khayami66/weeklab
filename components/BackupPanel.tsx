"use client";

import { useRef, useState } from "react";
import { localDataSource } from "@/lib/datasource/localDataSource";
import type { FullSnapshot } from "@/types";

type Props = {
  onToast: (message: string, kind: "success" | "info" | "error") => void;
};

/**
 * バックアップ（JSON エクスポート／インポート）。
 *
 * Weeklab のデータは**このブラウザの localStorage にしか存在しない**。
 * ブラウザの閲覧データ削除・PC入れ替え・別ブラウザへの移行で消える。
 * 成績の移行入力は7クラス×5テストで約2,100セル（約55分）あるため、
 * 消えたときの損失が大きい。**入力の前後に書き出せる導線をここに置く。**
 *
 * インポートは既存データを全部消してから復元する破壊的操作なので、
 * 中身の件数を数えて見せたうえで確認を取る。
 */
export default function BackupPanel({ onToast }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const snapshot = await localDataSource.exportAll();
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `weeklab-backup-${stamp()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const c = countSnapshot(snapshot);
      onToast(
        `バックアップを書き出しました（${c.years}年度・テスト${c.masters}件・得点${c.results}クラス分）`,
        "success"
      );
    } catch (err) {
      onToast(`書き出しに失敗しました: ${String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const snapshot = parseSnapshot(await file.text());
      const c = countSnapshot(snapshot);

      const ok = confirm(
        [
          "このファイルの内容で、現在のデータを置き換えます。",
          "",
          `ファイルの中身：${c.years}年度分 / テストマスタ${c.masters}件 / 得点${c.results}クラス分`,
          `書き出した日時：${formatExportedAt(snapshot.exported_at)}`,
          "",
          "※ 今このブラウザにあるデータは全部消えます。",
          "　 先に「バックアップを書き出す」で今の状態を保存しておくことを勧めます。",
        ].join("\n")
      );
      if (!ok) {
        setBusy(false);
        return;
      }

      await localDataSource.importAll(snapshot);
      onToast("復元しました。画面を読み込み直します。", "success");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      onToast(`復元できませんでした: ${String(err)}`, "error");
      setBusy(false);
    } finally {
      if (fileRef.current) fileRef.current.value = ""; // 同じファイルを選び直せるように
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="min-h-11 rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          バックアップを書き出す
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="min-h-11 rounded border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          ファイルから復元
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>

      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Weeklab のデータは<strong>このブラウザにだけ</strong>保存されています。
        閲覧データの削除・PCの入れ替え・別のブラウザでは引き継がれません。
        <strong>成績を大量に入力する前後には書き出しておいてください。</strong>
        復元すると、いま入っているデータは全部置き換わります。
      </p>
    </div>
  );
}

/**
 * スナップショットの書き出し日時を読める形にする。
 * どのバックアップかを日時で選ぶことになるので、ISO の生値のままにしない。
 */
function formatExportedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ファイル名に使う日時（YYYYMMDD-HHmm） */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * 読み込んだ JSON が Weeklab のバックアップであることを最低限確かめる。
 * 別のファイルを間違って選んだときに、全データを消してから気づくのを防ぐ。
 */
function parseSnapshot(text: string): FullSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON として読めません");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Weeklab のバックアップファイルではありません");
  }
  const snapshot = parsed as Partial<FullSnapshot>;
  if (typeof snapshot.current_year !== "number" || typeof snapshot.years !== "object") {
    throw new Error("Weeklab のバックアップファイルではありません");
  }
  if (Object.keys(snapshot.years ?? {}).length === 0) {
    throw new Error("年度データが入っていません");
  }
  return snapshot as FullSnapshot;
}

/** 確認ダイアログとトーストに出す件数（検算の材料） */
function countSnapshot(snapshot: FullSnapshot): {
  years: number;
  masters: number;
  results: number;
} {
  let masters = 0;
  let results = 0;
  for (const year of Object.values(snapshot.years)) {
    masters += year.test_masters?.length ?? 0;
    results += year.test_results?.length ?? 0;
  }
  return { years: Object.keys(snapshot.years).length, masters, results };
}

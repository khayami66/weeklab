"use client";

import { useEffect, useRef, useState } from "react";
import type { WorksheetMeta } from "@/types";
import {
  MAX_WORKSHEET_BYTES,
  addWorksheet,
  deleteWorksheet,
  formatBytes,
  getWorksheetBlob,
  listWorksheets,
} from "@/lib/store/worksheetStore";

type Props = {
  schoolYear: number;
  packId: string;
  unitName: string;
  /** 件数表示を更新させるための通知 */
  onChanged?: () => void;
};

/**
 * 単元に紐づくワークシート（PDF）の一覧・追加・削除。
 *
 * ChatGPT 等で作ったワークシートを単元に貼っておき、授業のときに開く用途。
 * **原本は本人の手元にある前提の「控え」**なので、
 * ブラウザのデータを消すと失われることを画面に明示する。
 */
export default function WorksheetPanel({ schoolYear, packId, unitName, onChanged }: Props) {
  const [items, setItems] = useState<WorksheetMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 単元を切り替えたときは呼び出し側で `key` を変えて作り直す。
  // ここで `setLoading(true)` を書くと effect 内の同期 setState になり、
  // 余分な再レンダーを生む（React 公式が避けるよう言っている形）。
  useEffect(() => {
    let cancelled = false;
    listWorksheets(schoolYear, packId, unitName)
      .then((list) => {
        if (!cancelled) {
          setItems(list);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [schoolYear, packId, unitName]);

  const reload = async () => {
    setItems(await listWorksheets(schoolYear, packId, unitName));
    onChanged?.();
  };

  const handleFiles = async (files: FileList) => {
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await addWorksheet(schoolYear, packId, unitName, file);
      }
      await reload();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = ""; // 同じファイルを選び直せるように
    }
  };

  /**
   * 別タブで開く。
   * Blob URL は使い終わったら解放する必要があるが、開いたタブが読み終わる前に
   * 解放すると表示できないため、少し待ってから解放する。
   */
  const open = async (item: WorksheetMeta) => {
    const blob = await getWorksheetBlob(item.id);
    if (!blob) {
      setError("ファイルが見つかりません（削除された可能性があります）");
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const download = async (item: WorksheetMeta) => {
    const blob = await getWorksheetBlob(item.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const remove = async (item: WorksheetMeta) => {
    if (!confirm(`「${item.file_name}」を削除します。よろしいですか？`)) return;
    await deleteWorksheet(item.id);
    await reload();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="min-h-9 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "保存中..." : "＋ PDF を追加"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = e.target.files;
            if (fs && fs.length > 0) void handleFiles(fs);
          }}
        />
        {!loading && items.length > 0 && (
          <span className="text-xs text-slate-500">{items.length}件</span>
        )}
      </div>

      {error && (
        <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500">
          この単元のワークシートはまだありません。作った PDF を追加しておくと、
          授業のときにここから開けます。
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <button
                type="button"
                onClick={() => open(w)}
                className="min-w-0 flex-1 truncate text-left text-blue-600 underline hover:text-blue-800"
                title={`${w.file_name} を開く`}
              >
                {w.file_name}
              </button>
              <span className="shrink-0 text-xs tabular-nums text-slate-400">
                {formatBytes(w.size)}
              </span>
              <button
                type="button"
                onClick={() => download(w)}
                className="shrink-0 text-xs text-slate-500 underline hover:text-slate-700"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => remove(w)}
                className="shrink-0 text-xs text-rose-600 underline hover:text-rose-800"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        PDF は<strong>このブラウザの中だけ</strong>に保存されます。
        <strong>JSON バックアップには含まれません。</strong>
        閲覧データの削除・PCの入れ替えで消えるので、
        <strong>作った PDF の原本は手元に残しておいてください。</strong>
        （1ファイル {formatBytes(MAX_WORKSHEET_BYTES)} まで）
      </p>
    </div>
  );
}

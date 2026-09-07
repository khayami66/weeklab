import type { Worksheet, WorksheetMeta } from "@/types";

/**
 * ワークシート（PDF）の保存。**localStorage ではなく IndexedDB を使う。**
 *
 * localStorage は文字列で約5MB が上限で、PDF を入れるには base64 化が要り
 * サイズが約1.3倍になる。ワークシートは1枚 200KB〜1MB なので数枚で上限に達し、
 * **他のデータ（設定・進度・成績）ごと保存できなくなる**危険がある。
 * IndexedDB は Blob をそのまま持て、容量も桁違いに大きい。
 *
 * ⚠ **JSON バックアップ（`exportAll`）には含まれない。**
 * 原本は本人の手元にある前提の「控え」として置く。
 * ブラウザのデータ削除・PC入れ替えで消える。画面にその旨を出すこと。
 */

const DB_NAME = "weeklab";
const DB_VERSION = 1;
const STORE = "worksheets";

/** 1ファイルの上限。これを超えると IndexedDB の書き込みも重くなる */
export const MAX_WORKSHEET_BYTES = 20 * 1024 * 1024; // 20MB

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        // 単元ごとに引くための索引。year を含めて年度をまたいでも混ざらないようにする
        store.createIndex("byUnit", ["school_year", "pack_id", "unit_name"], {
          unique: false,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB を開けません"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB の操作に失敗しました"));
        t.oncomplete = () => db.close();
      })
  );
}

/** Blob を除いた一覧用の情報に落とす */
function toMeta(w: Worksheet): WorksheetMeta {
  return {
    id: w.id,
    school_year: w.school_year,
    pack_id: w.pack_id,
    unit_name: w.unit_name,
    file_name: w.file_name,
    size: w.size,
    added_at: w.added_at,
    note: w.note,
  };
}

/** その単元のワークシート一覧（PDF本体は読まない。一覧表示を軽くするため） */
export async function listWorksheets(
  schoolYear: number,
  packId: string,
  unitName: string
): Promise<WorksheetMeta[]> {
  if (!isBrowser()) return [];
  const all = await tx<Worksheet[]>("readonly", (s) =>
    s.index("byUnit").getAll([schoolYear, packId, unitName])
  );
  return all
    .map(toMeta)
    .sort((a, b) => a.added_at.localeCompare(b.added_at) || a.file_name.localeCompare(b.file_name));
}

/** 年度内の全件（単元ボタンに件数を出すため。Blob は読まない） */
export async function listAllWorksheets(schoolYear: number): Promise<WorksheetMeta[]> {
  if (!isBrowser()) return [];
  const all = await tx<Worksheet[]>("readonly", (s) => s.getAll());
  return all.filter((w) => w.school_year === schoolYear).map(toMeta);
}

/** PDF本体を1件取り出す（開くとき・ダウンロードするとき） */
export async function getWorksheetBlob(id: string): Promise<Blob | null> {
  if (!isBrowser()) return null;
  const w = await tx<Worksheet | undefined>("readonly", (s) => s.get(id));
  return w ? w.blob : null;
}

export async function addWorksheet(
  schoolYear: number,
  packId: string,
  unitName: string,
  file: File,
  note = ""
): Promise<WorksheetMeta> {
  if (!isBrowser()) throw new Error("この環境では保存できません");
  if (file.size > MAX_WORKSHEET_BYTES) {
    throw new Error(
      `ファイルが大きすぎます（${formatBytes(file.size)}）。${formatBytes(MAX_WORKSHEET_BYTES)} までにしてください`
    );
  }
  const w: Worksheet = {
    id: `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    school_year: schoolYear,
    pack_id: packId,
    unit_name: unitName,
    file_name: file.name,
    size: file.size,
    added_at: new Date().toISOString(),
    note,
    blob: file,
  };
  await tx("readwrite", (s) => s.put(w));
  return toMeta(w);
}

export async function deleteWorksheet(id: string): Promise<void> {
  if (!isBrowser()) return;
  await tx("readwrite", (s) => s.delete(id));
}

/** 「1.2 MB」のように読める形にする */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

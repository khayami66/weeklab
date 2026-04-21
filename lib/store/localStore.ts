/**
 * localStorage 共通処理（SSR 安全）
 *
 * - Next.js App Router では layout/page が Server Components として pre-render される
 * - その時点では window が存在しないので localStorage も参照不可
 * - isBrowser() で守ってブラウザ時のみアクセス
 * - SSR 時は fallback 値を返す（UIはマウント後に useEffect で再取得する運用）
 */

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getItem<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota 超過など。握りつぶしつつ本番では上位にエラー通知すべき
  }
}

export function removeItem(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // noop
  }
}

/** 指定プレフィックスで始まるキー一覧を返す */
export function listKeys(prefix: string): string[] {
  if (!isBrowser()) return [];
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

// ================================================================
// キー命名（data_model.md §7 永続化キー命名）
// ================================================================

export const META_CURRENT_YEAR_KEY = "weeklab.meta.current_year";
export const META_YEARS_KEY = "weeklab.meta.years";

/** 年度プレフィックス付きキー：weeklab.{year}.{type}_v1 */
export function yearKey(year: number, type: string): string {
  return `weeklab.${year}.${type}_v1`;
}

/** 週案メモ：weeklab.{year}.memo.{date}.{class_code}.{period} */
export function memoKey(year: number, date: string, classCode: string, period: number): string {
  return `weeklab.${year}.memo.${date}.${classCode}.${period}`;
}

/** 週先頭コマ確定：weeklab.{year}.first_lesson.{monday_date} */
export function firstLessonKey(year: number, mondayDate: string): string {
  return `weeklab.${year}.first_lesson.${mondayDate}`;
}

/** アーカイブメタ：weeklab.archive.{year}.meta */
export function archiveMetaKey(year: number): string {
  return `weeklab.archive.${year}.meta`;
}

/** アーカイブ週データ：weeklab.archive.{year}.weeks */
export function archiveWeeksKey(year: number): string {
  return `weeklab.archive.${year}.weeks`;
}

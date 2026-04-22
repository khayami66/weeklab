/**
 * 週・曜日・週番号に関する純粋関数。
 *
 * JavaScript の Date は内部的に UTC タイムスタンプだが、
 * 本アプリでは常にローカル（JST）の日付計算を行う前提で実装。
 * Date の変異を避けるため、全関数で入力を複製してから操作する。
 */

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * 引数の日付が属する週の月曜日を返す（00:00:00 に正規化）。
 * 日曜日を渡した場合は **前週の月曜日** を返す（月曜開始の週管理）。
 */
export function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=日, 1=月, ..., 6=土
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * 月曜日を起点に月〜土の6日分の Date 配列を返す。
 * 日曜は含まない（Weeklab は月〜土の6行表示）。
 */
export function getWeekDates(monday: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * 始業式日（YYYY-MM-DD）を起点に、date が第何週に属するかを返す。
 * 始業式日の週を第1週、翌週を第2週…として加算。
 * 始業式日より前の週は 0 以下を返す（呼び出し側で扱う前提）。
 */
export function getWeekNumber(date: Date, startDate: string): number {
  const start = parseISODate(startDate);
  const startMonday = getMondayOf(start);
  const targetMonday = getMondayOf(date);
  const diffMs = targetMonday.getTime() - startMonday.getTime();
  const weeks = Math.floor(diffMs / MS_PER_WEEK);
  return weeks + 1;
}

/**
 * 日付フォーマット。
 * サポートトークン：
 *   YYYY … 西暦4桁（例: "2026"）
 *   MM   … 月をゼロパディング（例: "04"）
 *   M    … 月（例: "4"）
 *   DD   … 日をゼロパディング（例: "06"）
 *   D    … 日（例: "6"）
 *
 * 使用例：
 *   formatDate(d, "YYYY-MM-DD")   → "2026-04-06"
 *   formatDate(d, "M月D日")        → "4月6日"
 *   formatDate(d, "MM月DD日")      → "04月06日"
 */
export function formatDate(date: Date, format: string): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  // MM/DD は M/D より先に置換する必要がある（2文字トークンを先に消費）
  return format
    .replace(/YYYY/g, String(y))
    .replace(/MM/g, String(m).padStart(2, "0"))
    .replace(/DD/g, String(d).padStart(2, "0"))
    .replace(/M/g, String(m))
    .replace(/D/g, String(d));
}

/**
 * "YYYY-MM-DD" 形式の文字列をローカルタイムの Date に変換。
 * `new Date("2026-04-06")` は UTC 扱いで時差のある地域でズレるため、
 * 自前パースでローカルタイム（00:00:00 JST）を保証する。
 */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

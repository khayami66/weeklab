# development_steps.md

設計承認 → 実装 → 動作確認の順。各ステップで「動くもの」を最小単位で積む。

---

## Step 0: 設計レビュー（← 今ここ）
- 設計ドキュメント一式（requirements / data_model / screen_design / development_steps / directory_structure / 要件定義書 / 作業工程手順書）のレビュー
- 承認後 Step 1 へ

## Step 1: プロジェクト初期化
- Next.js（App Router）＋ TypeScript ＋ Tailwind の雛形
- ESLint / Prettier
- 日本語フォント・青グレー系配色のベース
- 基本レイアウト（ヘッダー・サイドナビ）を仮配置
- **Vercelへのデプロイセットアップ**（無料枠、限定URL）

**確認**：`/` が表示、ナビ遷移、Vercel URL で同じ表示。

## Step 2: 型定義とディレクトリ構成
- `types/index.ts` に全型
  - パック層：`CurriculumPack` / `AnnualPlan` / `LessonMaster`
  - 個人設定層：`TeacherSetting`（school_year含む）/ `Timetable` / `TimetableOverride` / `ClassProgress`
  - 派生：`WeeklyPlan` / `WeekSummary` / `ClassTally` / `HealthLevel` / `ProgressHealth` / `MonthlySummary` / `MonthlyClassTally` / `FirstLessonConfirm`
  - アーカイブ：`ArchivedWeek` / `ArchiveMetadata` / `FullSnapshot`
- `data/curriculums/` / `data/user/` のフォルダ作成

**確認**：型エラーなく import できる。

## Step 3: カリキュラムパックの移植
- `data/curriculums/registry.ts`：パックID一覧
- `data/curriculums/keirinkan/science/grade3/{annualPlan,lessonMaster}.ts`
- `data/curriculums/keirinkan/science/grade4/{annualPlan,lessonMaster}.ts`

**確認**：パックIDから annualPlan / lessonMaster が引ける。

## Step 4: 教員個人設定の初期データ
- `data/user/initialSetting.ts`（school_year=2026、学校名、始業式日、使用パック）
- `data/user/initialTimetable.ts`（理科専科時間割、月〜土）
- `data/user/initialClassProgress.ts`（7クラス分）

**確認**：初期データが読める。

## Step 5: データソース抽象層と localStorage ストア
- `lib/datasource/index.ts`：`DataSource` インターフェース
- `lib/datasource/localDataSource.ts`：**年度プレフィックス付きキー**でTS定数＋localStorage 実装
- `lib/store/localStore.ts`：localStorage 読み書きの共通処理
- `hooks/useSetting` / `useTimetable` / `useOverrides` / `useClassProgress` / `useLessonMemo` / `useFirstLessonConfirms` / `useCurrentYear` / `useArchive`

**確認**：年度別キーで保存・復元できる。

## Step 6: 週関連ユーティリティ
- `lib/date.ts`
  - `getMondayOf(date)`
  - `getWeekDates(monday)`（月〜土）
  - `getWeekNumber(date, startDate)`

**確認**：始業式日基準で週番号が正しく算出。

## Step 7: 週案生成ロジック
- `lib/progress.ts`：`resolveCurrentLesson` / 単元繰り上げ（年間計画順）
- `lib/weeklyPlan.ts`：`generateWeeklyPlan`（週先頭コマ確定対応） / `getLessonsForDate`
- `lib/summary.ts`：`computeWeekSummary`（週実施・累計） / `computeMonthSummary`
- `lib/healthCheck.ts`：`checkProgressHealth`（期待累計との差から ok/warn/alert 判定）
- `lib/format.ts`：`formatLessonsForLine`

**確認**：Node単体実行で期待値通り。月をまたぐ月次集計も正しい。進度ヘルスチェックが閾値通り動く。

## Step 8: ホーム画面 `/`
- 今日のカード
- 今週のサマリ
- クイックアクション

**確認**：初期データで今日・今週が表示。

## Step 9: 設定画面 `/settings`（基本情報）
- 学校名・教員名・始業式日・使用パック
- 保存 → トースト

**確認**：始業式日を変えると週番号がリアルタイムに変わる。

## Step 10: 進度管理画面 `/progress`
- クラス一覧テーブル
- 単元セレクト、完了時数・累計時数
- **進度ヘルスバッジ**（期待累計との差で ok/warn/alert 表示）
- 「次の単元に進める」ヘルパー
- 保存 → トースト

**確認**：保存後、ホーム・週案の表示が連動。ヘルスバッジが閾値通り表示。

## Step 11: 時間割・例外画面 `/timetable`
- 基本時間割表示
- 例外プルダウン（休講／差し替え／追加）
- 保存

**確認**：例外が週案生成に反映。

## Step 12: 週案生成画面 `/weekly`
- 週セレクタ
- **週先頭コマ確定エリア**：クラスごとに今週最初のコマの単元・本時を確定（デフォルト：ClassProgress から推定）
- 曜日ごと一覧（月〜土、先頭コマ以降は自動表示）
- メモ inline 編集
- 上部：週番号・期間・クラス別集計（週実施・累計）・進度ヘルスバッジ
- 例外コマに変更バッジ
- 「🖨 印刷」→ `/print/weekly`

**確認**：前後週の切替、先頭コマ確定の反映、メモ保持、例外反映、集計表示、ヘルスバッジ。

## Step 13: 週案印刷画面 `/print/weekly`
- 松戸市様式（理科専科版）
- A4横、月〜土 × 時限のグリッド
- 各セル：クラス／単元／授業内容
- 下段：クラス別 週実施／実施累計
- `@media print` 対応、検印欄は空欄

**確認**：印刷プレビューで提出可能な見た目。

## Step 14: マスタ確認画面 `/master`
- 年間指導計画タブ
- 授業内容タブ

**確認**：全マスタが閲覧できる。

## Step 14.5: 月次集計画面 `/monthly`
- 月セレクタ
- クラス×単元マトリクス表示
- `computeMonthSummary` の結果を描画
- 「🖨 印刷」→ `/print/monthly`

**確認**：月をまたぐ週も月曜日の月基準で正しく集計される。印刷プレビューで教育委員会提出品質。

## Step 15: 年度管理機能
- `lib/archive.ts`
  - `switchYear(newYear, newStartDate, copyTimetable)`
  - `listArchivedYears()`
  - `getArchivedWeeks(year)`
- `/settings` に年度切替モーダル追加
  - 現年度凍結（`ArchivedWeek[]` 生成・保存）
  - 新年度初期化

**確認**：年度切替後、進度リセット、アーカイブ保存、ヘッダー表示更新。

## Step 16: アーカイブ閲覧画面 `/archive`
- 年度一覧
- 週選択 → 読み取り専用で表示
- 印刷対応

**確認**：過去年度の週案が当時の内容で見られる、編集不可。

## Step 17: JSONエクスポート/インポート
- `lib/exportImport.ts`
  - `exportAll()`（全年度を1JSON化してダウンロード）
  - `importAll(snapshot)`（確認ダイアログ → 上書き）
- `/settings` にボタン追加

**確認**：エクスポート→ブラウザキャッシュクリア→インポートで完全復元。

## Step 18: 仕上げ
- 配色統一
- PCレイアウト調整（Chrome / Edge）
- iPad Chrome で軽く確認（MVP動作保証対象外、時間があれば）
- `README.md`（起動方法・使い方・既知の制限）
- デッドコード削除

**確認**：PC Chrome で全機能が動き、1週間分の週案を印刷できる。

---

## 将来拡張ステップ（参考）

| Step | 内容 |
|---|---|
| 19 | CSVインポート（マスタ・進度） |
| 20 | 学校カレンダー連携 |
| 21 | Google スプレッドシート連携 |
| 22 | 他教科・他出版社パック |
| 23 | 他自治体の印刷様式 |
| 24 | PDF / Excel 出力 |
| 25 | 授業後の実施記録・反省 |
| 26 | LINE通知（Vercel Cron） |
| 27 | 成績システムとのAPI連携 |

---

## 各ステップの確認ポリシー
- ロジック変更後は `lib/` 関数の期待値テストを先に通す
- UI変更後は画面を実際に触って golden path ＋ 主要エッジケースを確認
- 型エラー・ESLintエラーはゼロで進める

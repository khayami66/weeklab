# directory_structure.md

Next.js App Router 前提。**ロジック・データ・UIの分離** と **カリキュラムパック／教員個人設定の二層構造** を実現。年度管理・アーカイブ・エクスポート機能の拡張点も予約済み。

## 1. 全体構成

```
weeklab/
├── app/                                  # Next.js App Router
│   ├── layout.tsx                        # ルートレイアウト
│   ├── page.tsx                          # ホーム /
│   ├── globals.css
│   ├── weekly/page.tsx                   # 週案生成＋週内例外＋「今週を実施済みに確定」
│   ├── print/
│   │   ├── weekly/page.tsx               # 週案印刷
│   │   └── monthly/page.tsx              # 月次集計印刷
│   ├── progress/page.tsx                 # 進度管理（補正用）
│   ├── settings/page.tsx                 # 設定：基本情報＋学年構成＋基本時間割＋年度切替＋エクスポート
│   ├── monthly/page.tsx                  # 月次集計（教育委員会報告用）
│   ├── archive/page.tsx                  # アーカイブ閲覧
│   └── master/page.tsx                   # マスタ確認
│                                         # ※ /timetable は廃止（基本時間割→/settings、週内例外→/weekly）
│
├── components/                           # 再利用UIコンポーネント
│   ├── Header.tsx
│   ├── SideNav.tsx
│   ├── MobileNav.tsx
│   ├── PageHeader.tsx
│   ├── LessonCard.tsx
│   ├── WeeklyGrid.tsx                    # 週案テーブル（画面・印刷・アーカイブ共通）
│   ├── WeekSummaryTable.tsx
│   ├── WeekPicker.tsx
│   ├── ClassProgressRow.tsx
│   ├── OverrideRow.tsx
│   ├── YearSwitchModal.tsx
│   ├── ExportImportPanel.tsx
│   ├── ArchiveYearList.tsx
│   ├── ReadOnlyBanner.tsx
│   ├── MasterTable.tsx
│   ├── HealthBadge.tsx                   # 進度ヘルス表示
│   ├── FirstLessonConfirmRow.tsx         # 週先頭コマ確定1行
│   ├── TimetableEditor.tsx               # 基本時間割マトリクス編集（設定画面内）
│   ├── MonthlyTable.tsx                  # 月次集計テーブル
│   ├── Badge.tsx
│   └── Toast.tsx
│
├── lib/                                  # 純粋ロジック層（UI非依存）
│   ├── date.ts                           # 週・曜日・週番号
│   ├── progress.ts                       # 進度計算・単元繰り上げ
│   ├── weeklyPlan.ts                     # 週案生成 / getLessonsForDate
│   ├── summary.ts                        # 週実施・実施累計・月次集計
│   ├── healthCheck.ts                    # 進度ヘルスチェック
│   ├── format.ts                         # LINE文面・日付整形
│   ├── archive.ts                        # 年度切替・アーカイブ管理
│   ├── exportImport.ts                   # JSONエクスポート/インポート
│   ├── store/
│   │   └── localStore.ts                 # localStorage 共通処理（年度キー管理）
│   └── datasource/
│       ├── index.ts                      # DataSource インターフェース
│       └── localDataSource.ts
│
├── hooks/                                # React Hooks
│   ├── useSetting.ts
│   ├── useTimetable.ts
│   ├── useOverrides.ts
│   ├── useClassProgress.ts
│   ├── useWeeklyPlan.ts
│   ├── useLessonMemo.ts
│   ├── useFirstLessonConfirms.ts         # 週先頭コマ確定
│   ├── useCurrentYear.ts
│   └── useArchive.ts
│
├── data/                                 # データ層（二層）
│   ├── curriculums/                      # 【共有】カリキュラムパック
│   │   ├── registry.ts                   # パックID一覧・メタ情報
│   │   └── keirinkan/
│   │       └── science/
│   │           ├── grade3/
│   │           │   ├── annualPlan.ts
│   │           │   └── lessonMaster.ts
│   │           └── grade4/
│   │               ├── annualPlan.ts
│   │               └── lessonMaster.ts
│   └── user/                             # 【個人】初期値
│       ├── initialSetting.ts
│       ├── initialTimetable.ts
│       └── initialClassProgress.ts
│
├── types/
│   └── index.ts                          # 全型定義
│
├── public/
│
├── scripts/                              # 補助スクリプト（将来）
│   └── csv-to-ts.ts
│
├── docs/                                 # 設計ドキュメント
│   ├── requirements.md
│   ├── data_model.md
│   ├── screen_design.md
│   ├── development_steps.md
│   ├── directory_structure.md
│   ├── 要件定義書.md
│   └── 作業工程手順書.md
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.ts
├── .eslintrc.json
├── .prettierrc
├── .gitignore
└── README.md
```

## 2. 配置ルール

| 種類 | 場所 | ルール |
|---|---|---|
| 画面 | `app/*/page.tsx` | 状態最小限、ロジックは `lib/` 経由 |
| 印刷画面 | `app/print/*/page.tsx` | `@media print` 対応 |
| UI部品 | `components/` | ビジネスロジックを持たない |
| 純粋ロジック | `lib/` | React/Next 非依存、テスト可能 |
| 型 | `types/index.ts` | 全体共有、1ファイル集約 |
| 共有カリキュラム | `data/curriculums/{publisher}/{subject}/grade{n}/` | パック単位 |
| 個人設定 | `data/user/` | 初期値のみ、編集は localStorage |
| データアクセス | `lib/datasource/` | `DataSource` 経由のみ |
| Hooks | `hooks/` | `use` プレフィックス |

## 3. 依存方向ルール

```
app / components ──► hooks ──► lib ──► data / types
```

逆向きの import は禁止（ESLintで段階的に縛る）。

## 4. パックID命名規則
`{publisher}.{subject}.grade{n}`
- `keirinkan.science.grade3`
- `keirinkan.science.grade4`
- 将来：`tokyosyoseki.mathematics.grade5` など

## 5. localStorage キー命名
`weeklab.{year}.{type}_v1`
- 現年度ポインタ：`weeklab.meta.current_year`
- アーカイブ：`weeklab.archive.{year}.*`

## 6. 将来追加予定パス（予約）

| パス | 用途 |
|---|---|
| `data/curriculums/tokyosyoseki/...` | 東京書籍 |
| `data/curriculums/keirinkan/mathematics/...` | 啓林館算数 |
| `app/api/line/today/route.ts` | LINE通知API |
| `app/records/page.tsx` | 授業実施記録 |
| `lib/datasource/sheetsDataSource.ts` | Google Sheets 連携 |
| `lib/datasource/apiDataSource.ts` | 独自API |
| `lib/export/pdf.ts` / `excel.ts` | 出力形式 |
| `lib/print/templates/matsudo.ts` | 松戸市様式（他自治体対応時に分離） |
| `lib/integrations/gradeSystem.ts` | 成績システム連携 |

## 7. 命名規約
- 画面：`page.tsx`
- コンポーネント：`PascalCase.tsx`
- ロジック・フック：`camelCase.ts`
- 定数データ：`camelCase.ts`
- 型：`PascalCase`

## 8. README に書く内容（Step 18）
- プロジェクト概要
- 起動手順（`npm install` → `npm run dev`）
- Vercel デプロイ手順
- 画面の使い方
- 年度切替・バックアップの運用
- マスタ／パック更新手順
- 既知の制限事項
- 将来の拡張計画

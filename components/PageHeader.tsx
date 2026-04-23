import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

/**
 * 各画面共通のページヘッダー。
 * タイトル + （任意）サブタイトル + （任意）右寄せアクション（印刷ボタン等）。
 */
export default function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </header>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComingSoon({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div className="stagger-in flex flex-1 flex-col gap-8">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted" asChild>
        <Link to="/">
          <ArrowLeft />
          メニューへ戻る
        </Link>
      </Button>

      <div className="max-w-lg">
        <p className="font-sans text-xs font-medium tracking-widest text-subtle">
          {index}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-muted">{description}</p>
      </div>

      <div className="rounded-xl border border-border bg-surface px-6 py-8 shadow-card">
        <p className="font-display text-lg font-semibold text-fg">準備中</p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          この機能はこれから実装します。記録・履歴・振り返りを、この画面から使えるようにしていきます。
        </p>
      </div>
    </div>
  );
}

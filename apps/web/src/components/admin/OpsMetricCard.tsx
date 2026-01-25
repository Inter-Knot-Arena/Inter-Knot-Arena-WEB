import { ReactNode } from "react";

interface OpsMetricCardProps {
  title: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  warning?: boolean;
  footer?: string;
}

export function OpsMetricCard({
  title,
  value,
  description,
  icon,
  warning,
  footer
}: OpsMetricCardProps) {
  const wrapperClass = warning
    ? "border border-amber-500/40 bg-amber-500/5"
    : "border border-border bg-ika-800/70";

  return (
    <div className={`rounded-xl p-4 ${wrapperClass}`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-ink-500">
        <span>{title}</span>
        {icon ? <span className="text-ink-500">{icon}</span> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
      {description ? <div className="mt-1 text-xs text-ink-500">{description}</div> : null}
      {footer ? <div className="mt-3 text-xs text-ink-500">{footer}</div> : null}
    </div>
  );
}

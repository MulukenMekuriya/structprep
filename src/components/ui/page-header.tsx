import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: ReactNode;
  iconGradient?: string;
  iconAccent?: string;
  title: string;
  description: string;
  badge?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({
  icon,
  iconGradient = "from-indigo-500 to-violet-600",
  iconAccent,
  title,
  description,
  badge,
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${iconGradient} shadow-lg shadow-indigo-500/15 dark:shadow-indigo-500/10 ${iconAccent || "text-white"}`}
            >
              {icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          {badge}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h2>
      {action}
    </div>
  );
}

interface StatCardProps {
  icon: ReactNode;
  iconColor?: string;
  label: string;
  value: ReactNode;
  gradient?: string;
}

export function StatCard({
  icon,
  iconColor = "text-primary",
  label,
  value,
  gradient = "from-primary/5 to-transparent",
}: StatCardProps) {
  return (
    <div
      className={`rounded-xl border bg-gradient-to-br ${gradient} p-4 hover-lift`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={iconColor}>{icon}</span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

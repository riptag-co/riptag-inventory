import { cn, statusVariant } from '@/lib/utils';

export function GlassCard({
  children,
  className,
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'strong';
}) {
  return (
    <div
      className={cn(
        variant === 'strong' ? 'glass-strong' : 'glass',
        className
      )}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string | number;
  hint?: string;
  emphasis?: 'accent' | 'warn' | 'bad' | 'ok' | 'default';
}) {
  const colorMap = {
    accent: 'text-accent',
    warn: 'text-warn',
    bad: 'text-bad',
    ok: 'text-ok',
    default: 'text-text-primary',
  } as const;
  return (
    <GlassCard className="p-5">
      <div className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary font-medium">{label}</div>
      <div className={cn('num-display text-[32px] font-semibold leading-none mt-3', colorMap[emphasis ?? 'default'])}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-text-tertiary mt-2">{hint}</div>}
    </GlassCard>
  );
}

export function StatusPill({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const v = statusVariant(status);
  const cls =
    v === 'ok' ? 'pill-ok'
    : v === 'warn' ? 'pill-warn'
    : v === 'bad' ? 'pill-bad'
    : v === 'info' ? 'pill-info'
    : 'pill-neutral';
  return <span className={cn('pill', cls)}>{label ?? status.replace(/_/g, ' ')}</span>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between mb-8">
      <div>
        <h1 className="font-display text-[28px] font-semibold tracking-tight leading-none">{title}</h1>
        {subtitle && <p className="text-[13px] text-text-secondary mt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-[13px] font-medium tracking-wide uppercase text-text-secondary">{children}</h2>
      {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
    </div>
  );
}

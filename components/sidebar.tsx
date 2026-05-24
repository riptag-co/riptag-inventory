'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconLayoutDashboard,
  IconShoppingBag,
  IconTruck,
  IconBox,
  IconFilePencil,
  IconLogout,
  type Icon,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; icon: Icon; ownerOnly?: boolean };

const ITEMS: Item[] = [
  { href: '/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { href: '/new-orders', label: 'New Orders', icon: IconFilePencil },
  { href: '/orders', label: 'Orders', icon: IconShoppingBag },
  { href: '/shipments', label: 'Shipments', icon: IconTruck },
  { href: '/catalog', label: 'Catalog', icon: IconBox },
];

export function Sidebar({
  user,
}: {
  user: { email: string; role: 'owner' | 'supplier'; displayName: string | null };
}) {
  const pathname = usePathname();
  const initials = (user.displayName || user.email).slice(0, 2).toUpperCase();

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col p-4 gap-4 border-r border-white/[0.04]">
      <div className="flex items-center gap-2.5 px-2 pt-1">
        <div className="w-7 h-7 rounded-md bg-accent grid place-items-center text-white font-display font-bold text-sm tracking-tighter">
          R
        </div>
        <div>
          <div className="font-display font-semibold tracking-tight text-[15px] leading-none">Riptag</div>
          <div className="text-[10px] uppercase tracking-[0.1em] text-text-tertiary leading-none mt-1">Inventory</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 mt-2">
        {ITEMS.map((item) => {
          if (item.ownerOnly && user.role !== 'owner') return null;
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors',
                active
                  ? 'bg-white/[0.05] text-text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.025]'
              )}
            >
              <Icon size={16} stroke={1.75} />
              <span>{item.label}</span>
              {active && <span className="ml-auto w-1 h-1 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 px-2 py-2 rounded-lg border border-white/[0.05] bg-white/[0.015]">
        <div className="w-7 h-7 rounded-full bg-white/[0.06] grid place-items-center text-[11px] font-medium text-text-secondary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium truncate">{user.displayName || user.email}</div>
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider">{user.role}</div>
        </div>
        <form action="/api/logout" method="post">
          <button
            type="submit"
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/[0.05] transition-colors"
            aria-label="Sign out"
          >
            <IconLogout size={14} stroke={1.75} />
          </button>
        </form>
      </div>
    </aside>
  );
}

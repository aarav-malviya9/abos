'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Bot,
  CheckSquare,
  DollarSign,
  Users,
  Megaphone,
  BarChart,
  Zap,
  ShieldCheck,
  Lightbulb,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: Briefcase },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Financials', href: '/financials', icon: DollarSign },
  { name: 'CRM', href: '/crm', icon: Users },
  { name: 'Marketing', href: '/marketing', icon: Megaphone },
  { name: 'Analytics', href: '/analytics', icon: BarChart },
  { name: 'Automation', href: '/automation', icon: Zap },
  { name: 'Approvals', href: '/approvals', icon: ShieldCheck },
  { name: 'Recommendations', href: '/recommendations', icon: Lightbulb },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div
          className={cn(
            'flex h-16 items-center justify-between border-b px-4',
            collapsed && 'justify-center'
          )}
        >
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              <Bot className="h-6 w-6" />
              <span>ABOS</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'p-2 rounded-lg hover:bg-accent transition-colors',
              collapsed && 'ml-auto'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Main navigation">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="border-t p-4">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
              collapsed && 'justify-center'
            )}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>
      </div>
    </aside>
  );
}
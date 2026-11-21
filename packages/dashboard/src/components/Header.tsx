'use client';

import { Bell, Search, User, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export function Header() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search..."
              className="h-9 w-64 rounded-lg border bg-background px-10 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              'p-2 rounded-lg hover:bg-accent transition-colors',
              theme === 'dark' && 'rotate-180'
            )}
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5" />
            <Moon className="h-5 w-5" />
          </button>

          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center">
              3
            </span>
          </button>

          {/* User */}
          <div className="flex items-center gap-3 pl-4 border-l">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
              U
            </div>
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </header>
  );
}
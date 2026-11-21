import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-green-400',
    idle: 'text-gray-400',
    running: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    pending: 'text-yellow-400',
    queued: 'text-yellow-400',
    error: 'text-red-400',
    disabled: 'text-gray-500',
    planning: 'text-blue-400',
    building: 'text-yellow-400',
    launching: 'text-purple-400',
    paused: 'text-gray-400',
    closed: 'text-gray-500',
    lead: 'text-blue-400',
    qualified: 'text-green-400',
    contacted: 'text-yellow-400',
    meeting: 'text-purple-400',
    proposal: 'text-orange-400',
    negotiation: 'text-red-400',
    won: 'text-green-400',
    lost: 'text-red-400',
    draft: 'text-gray-400',
    review: 'text-yellow-400',
    approved: 'text-green-400',
    published: 'text-blue-400',
    archived: 'text-gray-500',
  };
  return colors[status] || 'text-gray-400';
}

export function getStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400',
    idle: 'bg-gray-500/10 text-gray-400',
    running: 'bg-blue-500/10 text-blue-400',
    completed: 'bg-green-500/10 text-green-400',
    failed: 'bg-red-500/10 text-red-400',
    pending: 'bg-yellow-500/10 text-yellow-400',
    queued: 'bg-yellow-500/10 text-yellow-400',
    error: 'bg-red-500/10 text-red-400',
    disabled: 'bg-gray-500/10 text-gray-500',
    planning: 'bg-blue-500/10 text-blue-400',
    building: 'bg-yellow-500/10 text-yellow-400',
    launching: 'bg-purple-500/10 text-purple-400',
    paused: 'bg-gray-500/10 text-gray-400',
    closed: 'bg-gray-500/10 text-gray-500',
    lead: 'bg-blue-500/10 text-blue-400',
    qualified: 'bg-green-500/10 text-green-400',
    contacted: 'bg-yellow-500/10 text-yellow-400',
    meeting: 'bg-purple-500/10 text-purple-400',
    proposal: 'bg-orange-500/10 text-orange-400',
    negotiation: 'bg-red-500/10 text-red-400',
    won: 'bg-green-500/10 text-green-400',
    lost: 'bg-red-500/10 text-red-400',
    draft: 'bg-gray-500/10 text-gray-400',
    review: 'bg-yellow-500/10 text-yellow-400',
    approved: 'bg-green-500/10 text-green-400',
    published: 'bg-blue-500/10 text-blue-400',
    archived: 'bg-gray-500/10 text-gray-500',
  };
  return badges[status] || 'bg-gray-500/10 text-gray-400';
}
'use client';

import { useEffect, useState } from 'react';
import {
  Briefcase,
  Bot,
  CheckSquare,
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  Zap,
  ShieldCheck,
  Lightbulb,
} from 'lucide-react';
import { cn, formatCurrency, formatRelativeTime, getStatusBadge } from '@/lib/utils';
import { api } from '@/lib/api';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  href?: string;
}

function StatCard({ title, value, icon, trend, trendUp, href }: StatCardProps) {
  return (
    <a
      href={href}
      className={cn(
        'group flex flex-col p-6 rounded-xl bg-card border hover:border-primary/50 transition-colors',
        href && 'cursor-pointer'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="p-3 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        {trend && (
          <span className={cn('text-xs font-medium', trendUp ? 'text-green-400' : 'text-red-400')}>
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
      </div>
    </a>
  );
}

interface AgentStatusProps {
  name: string;
  type: string;
  status: string;
  lastRun?: string;
  nextRun?: string;
}

function AgentStatus({ name, type, status, lastRun, nextRun }: AgentStatusProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-card border">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">{type}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusBadge(status))}>
          {status}
        </span>
        {lastRun && (
          <span className="text-muted-foreground">Last: {formatRelativeTime(lastRun)}</span>
        )}
        {nextRun && (
          <span className="text-muted-foreground">Next: {formatRelativeTime(nextRun)}</span>
        )}
      </div>
    </div>
  );
}

interface RecentActivityProps {
  activities: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId?: string;
    createdAt: string;
    agentId?: string;
  }>;
}

function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.slice(0, 10).map((activity) => (
        <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
          <div className="p-2 rounded-lg bg-muted">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{activity.action}</p>
            <p className="text-xs text-muted-foreground truncate">
              {activity.entityType} {activity.entityId ? `#${activity.entityId.slice(0, 8)}` : ''}
            </p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(activity.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DashboardOverview() {
  const [stats, setStats] = useState({
    activeProjects: 0,
    activeAgents: 0,
    pendingTasks: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    profit: 0,
    openDeals: 0,
    alerts: 0,
  });
  const [agents, setAgents] = useState<Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    lastRunAt?: string;
    nextRunAt?: string;
  }>>([]);
  const [activities, setActivities] = useState<Array<{
    id: string;
    action: string;
    entityType: string;
    entityId?: string;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [projects, agentsData, tasks, financialSummary, deals, alertsData, auditLogs] = await Promise.all([
          api.getProjects('active'),
          api.getAgents(),
          api.getAgentTasks('all'),
          api.getFinancialSummary('default', 'monthly'),
          api.getDeals(undefined, 'proposal'),
          api.getAlerts(),
          api.getReports(undefined, 'daily'),
        ]);

        setStats({
          activeProjects: projects.length,
          activeAgents: agentsData.filter((a: any) => a.status !== 'disabled').length,
          pendingTasks: tasks.filter((t: any) => t.status === 'pending' || t.status === 'queued').length,
          monthlyRevenue: financialSummary.revenue || 0,
          monthlyExpenses: financialSummary.expenses || 0,
          profit: financialSummary.profit || 0,
          openDeals: deals.length,
          alerts: alertsData.filter((a: any) => a.metadata?.severity === 'high' || a.metadata?.severity === 'critical').length,
        });

        setAgents(agentsData.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          status: a.status,
          lastRunAt: a.lastRunAt,
          nextRunAt: a.nextRunAt,
        })));

        setActivities(auditLogs.slice(0, 20).map((log: any) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          createdAt: log.createdAt,
        })));
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 rounded-xl bg-card border animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-4" />
              <div className="h-8 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 rounded-xl bg-card border animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-4" />
              <div className="h-8 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Projects"
          value={stats.activeProjects}
          icon={<Briefcase className="h-6 w-6" />}
          href="/projects"
        />
        <StatCard
          title="Active Agents"
          value={stats.activeAgents}
          icon={<Bot className="h-6 w-6" />}
          href="/agents"
        />
        <StatCard
          title="Pending Tasks"
          value={stats.pendingTasks}
          icon={<CheckSquare className="h-6 w-6" />}
          href="/tasks"
          trend={stats.pendingTasks > 10 ? '+2' : undefined}
          trendUp={false}
        />
        <StatCard
          title="Monthly Profit"
          value={formatCurrency(stats.profit)}
          icon={<DollarSign className="h-6 w-6" />}
          href="/financials"
          trend={stats.profit >= 0 ? 'Positive' : 'Negative'}
          trendUp={stats.profit >= 0}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue)}
          icon={<TrendingUp className="h-6 w-6" />}
          href="/financials"
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(stats.monthlyExpenses)}
          icon={<TrendingUp className="h-6 w-6" />}
          href="/financials"
        />
        <StatCard
          title="Open Deals"
          value={stats.openDeals}
          icon={<Users className="h-6 w-6" />}
          href="/crm"
        />
        <StatCard
          title="Critical Alerts"
          value={stats.alerts}
          icon={<AlertTriangle className="h-6 w-6" />}
          href="/approvals"
          trend={stats.alerts > 0 ? 'Attention' : undefined}
          trendUp={false}
        />
      </div>

      {/* Agent Status & Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-card border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Agent Status</h2>
            <a href="/agents" className="text-sm text-primary hover:underline">
              View all
            </a>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {agents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No agents configured</div>
            ) : (
              agents.map((agent) => (
                <AgentStatus key={agent.id} {...agent} />
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl bg-card border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <a href="/activity" className="text-sm text-primary hover:underline">
              View all
            </a>
          </div>
          <RecentActivity activities={activities} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl bg-card border p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <a
            href="/projects/new"
            className="flex flex-col items-center gap-2 p-6 rounded-lg bg-muted hover:bg-accent transition-colors"
          >
            <Briefcase className="h-8 w-8 text-primary" />
            <span className="font-medium">New Project</span>
            <span className="text-sm text-muted-foreground">Create business project</span>
          </a>
          <a
            href="/opportunities/new"
            className="flex flex-col items-center gap-2 p-6 rounded-lg bg-muted hover:bg-accent transition-colors"
          >
            <Lightbulb className="h-8 w-8 text-yellow-400" />
            <span className="font-medium">Research Opportunity</span>
            <span className="text-sm text-muted-foreground">Discover new models</span>
          </a>
          <a
            href="/agents"
            className="flex flex-col items-center gap-2 p-6 rounded-lg bg-muted hover:bg-accent transition-colors"
          >
            <Bot className="h-8 w-8 text-purple-400" />
            <span className="font-medium">Run Agent Task</span>
            <span className="text-sm text-muted-foreground">Execute manually</span>
          </a>
          <a
            href="/automation"
            className="flex flex-col items-center gap-2 p-6 rounded-lg bg-muted hover:bg-accent transition-colors"
          >
            <Zap className="h-8 w-8 text-green-400" />
            <span className="font-medium">View Workflows</span>
            <span className="text-sm text-muted-foreground">Manage automation</span>
          </a>
        </div>
      </div>
    </div>
  );
}
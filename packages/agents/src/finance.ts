import { z } from 'zod';
import { BaseAgent, AgentContext, AgentResult } from './base';
import {
  createEntity,
  getEntity,
  listEntities,
  agentLogger,
} from '@abos/core';

const FinancialReportSchema = z.object({
  period: z.string(),
  revenue: z.number(),
  expenses: z.number(),
  profit: z.number(),
  margin: z.number(),
  revenueBreakdown: z.record(z.number()),
  expenseBreakdown: z.record(z.number()),
  trends: z.object({
    revenueGrowth: z.number(),
    expenseGrowth: z.number(),
    profitGrowth: z.number(),
  }),
  forecasts: z.object({
    nextMonthRevenue: z.number(),
    nextMonthExpenses: z.number(),
    nextMonthProfit: z.number(),
  }),
  recommendations: z.array(z.string()),
});

export class FinanceAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    await this.updateAgentStatus('running');
    await this.logActivity('finance_agent_started', { taskType: context.task?.type });

    try {
      const taskType = context.task?.type || 'financial-report';

      let result: AgentResult;

      switch (taskType) {
        case 'financial-report':
          result = await this.generateFinancialReport(context);
          break;
        case 'expense-tracking':
          result = await this.trackExpenses(context);
          break;
        case 'margin-analysis':
          result = await this.analyzeMargins(context);
          break;
        case 'budget-planning':
          result = await this.planBudget(context);
          break;
        case 'cash-flow':
          result = await this.analyzeCashFlow(context);
          break;
        default:
          result = await this.generateFinancialReport(context);
      }

      await this.updateAgentStatus('completed');
      await this.logActivity('finance_agent_completed', { taskType, success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateAgentStatus('error', errorMessage);
      await this.logActivity('finance_agent_failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async generateFinancialReport(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    const period = context.task?.payload?.period as string || 'monthly';

    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const transactions = await listEntities<{
  id: string;
  projectId: string;
  type: 'revenue' | 'expense';
  amount: number;
  currency: string;
  category: string;
  description: string | undefined;
  date: string;
  reference: string | undefined;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}>('financialTransaction', { where: { projectId } });
    const now = new Date();
    let cutoffDate: Date;

    switch (period) {
      case 'daily':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
      default:
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const periodTransactions = transactions.filter(t => new Date(t.date) >= cutoffDate);
    const revenue = periodTransactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
    const expenses = periodTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const profit = revenue - expenses;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Breakdowns
    const revenueBreakdown: Record<string, number> = {};
    const expenseBreakdown: Record<string, number> = {};

    for (const t of periodTransactions) {
      if (t.type === 'revenue') {
        revenueBreakdown[t.category] = (revenueBreakdown[t.category] || 0) + t.amount;
      } else {
        expenseBreakdown[t.category] = (expenseBreakdown[t.category] || 0) + t.amount;
      }
    }

    // Previous period for trends
    const prevCutoff = new Date(cutoffDate.getTime() - (now.getTime() - cutoffDate.getTime()));
    const prevTransactions = transactions.filter(t => new Date(t.date) >= prevCutoff && new Date(t.date) < cutoffDate);
    const prevRevenue = prevTransactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
    const prevExpenses = prevTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const prevProfit = prevRevenue - prevExpenses;

    const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
    const expenseGrowth = prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : 0;
    const profitGrowth = prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;

    const prompt = `Analyze financial data and generate a report.

Period: ${period}
Revenue: $${revenue.toLocaleString()}
Expenses: $${expenses.toLocaleString()}
Profit: $${profit.toLocaleString()}
Margin: ${margin.toFixed(1)}%
Revenue Breakdown: ${JSON.stringify(revenueBreakdown)}
Expense Breakdown: ${JSON.stringify(expenseBreakdown)}
Revenue Growth: ${revenueGrowth.toFixed(1)}%
Expense Growth: ${expenseGrowth.toFixed(1)}%
Profit Growth: ${profitGrowth.toFixed(1)}%

Provide insights, forecasts, and actionable recommendations.`;

    const report = await this.callLLM(
      [
        { role: 'system', content: 'You are a CFO. Output structured financial analysis with forecasts.' },
        { role: 'user', content: prompt },
      ],
      { schema: FinancialReportSchema.shape }
    );

    const parsedReport = JSON.parse(report) as z.infer<typeof FinancialReportSchema>;

    await this.report(
      'daily',
      `${period.charAt(0).toUpperCase() + period.slice(1)} Financial Report`,
      JSON.stringify(parsedReport, null, 2),
      {
        revenue,
        expenses,
        profit,
        margin,
        revenueGrowth,
        expenseGrowth,
        profitGrowth,
      },
      parsedReport.recommendations,
      profit < 0 ? 'high' : 'medium'
    );

    return {
      success: true,
      output: { report: parsedReport },
      metrics: { revenue, expenses, profit, margin },
      recommendations: parsedReport.recommendations,
    };
  }

  private async trackExpenses(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const transactions = await listEntities<{
  id: string;
  projectId: string;
  type: 'revenue' | 'expense';
  amount: number;
  currency: string;
  category: string;
  description: string | undefined;
  date: string;
  reference: string | undefined;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}>('financialTransaction', { where: { projectId, type: 'expense' } });

    const prompt = `Analyze expenses for this project.

Total expenses: ${transactions.length} transactions
Total amount: $${transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}

By category: ${JSON.stringify(
  transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>)
)}

Identify: unnecessary expenses, optimization opportunities, budget alerts.`;

    const analysis = await this.callLLM([
      { role: 'system', content: 'You are a Financial Analyst. Output expense analysis.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Expense Analysis`,
      analysis,
      { projectId, totalExpenses: transactions.reduce((sum, t) => sum + t.amount, 0) },
      ['Review subscriptions', 'Negotiate better rates', 'Eliminate waste'],
      'medium'
    );

    return {
      success: true,
      output: { analysis },
      metrics: { totalExpenses: transactions.reduce((sum, t) => sum + t.amount, 0) },
      recommendations: ['Review subscriptions', 'Negotiate better rates', 'Eliminate waste'],
    };
  }

  private async analyzeMargins(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const transactions = await listEntities<{
  id: string;
  projectId: string;
  type: 'revenue' | 'expense';
  amount: number;
  currency: string;
  category: string;
  description: string | undefined;
  date: string;
  reference: string | undefined;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}>('financialTransaction', { where: { projectId } });
    const revenue = transactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    const prompt = `Analyze profit margins for this business.

Project: ${JSON.stringify(project, null, 2)}
Total Revenue: $${revenue.toLocaleString()}
Total Expenses: $${expenses.toLocaleString()}
Overall Margin: ${revenue > 0 ? ((revenue - expenses) / revenue * 100).toFixed(1) : 0}%

Provide: margin by product/service, cost structure analysis, improvement opportunities, pricing recommendations.`;

    const analysis = await this.callLLM([
      { role: 'system', content: 'You are a CFO analyzing margins. Output detailed analysis.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Margin Analysis`,
      analysis,
      { projectId, revenue, expenses },
      ['Optimize pricing', 'Reduce variable costs', 'Focus on high-margin offerings'],
      'high'
    );

    return {
      success: true,
      output: { analysis },
      metrics: { revenue, expenses, margin: revenue > 0 ? (revenue - expenses) / revenue * 100 : 0 },
      recommendations: ['Optimize pricing', 'Reduce variable costs', 'Focus on high-margin offerings'],
    };
  }

  private async planBudget(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const prompt = `Create a budget plan for the next quarter.

Project: ${JSON.stringify(project, null, 2)}

Include: revenue targets, expense budgets by category, investment priorities, cash flow projections, contingency planning.`;

    const budget = await this.callLLM([
      { role: 'system', content: 'You are a CFO creating budgets. Output structured budget plan.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Quarterly Budget Plan`,
      budget,
      { projectId },
      ['Approve budget with CEO', 'Track monthly vs budget', 'Adjust as needed'],
      'high'
    );

    return {
      success: true,
      output: { budget },
      metrics: {},
      recommendations: ['Approve budget with CEO', 'Track monthly vs budget', 'Adjust as needed'],
    };
  }

  private async analyzeCashFlow(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const transactions = await listEntities<{
  id: string;
  projectId: string;
  type: 'revenue' | 'expense';
  amount: number;
  currency: string;
  category: string;
  description: string | undefined;
  date: string;
  reference: string | undefined;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}>('financialTransaction', { where: { projectId } });

    // Group by month
    const monthlyFlow: Record<string, { revenue: number; expenses: number; net: number }> = {};

    for (const t of transactions) {
      const month = t.date.slice(0, 7); // YYYY-MM
      if (!monthlyFlow[month]) {
        monthlyFlow[month] = { revenue: 0, expenses: 0, net: 0 };
      }
      if (t.type === 'revenue') {
        monthlyFlow[month].revenue += t.amount;
      } else {
        monthlyFlow[month].expenses += t.amount;
      }
      monthlyFlow[month].net = monthlyFlow[month].revenue - monthlyFlow[month].expenses;
    }

    const prompt = `Analyze cash flow patterns.

Monthly flow: ${JSON.stringify(monthlyFlow, null, 2)}

Identify: cash flow trends, seasonal patterns, runway, funding needs, optimization opportunities.`;

    const analysis = await this.callLLM([
      { role: 'system', content: 'You are a CFO analyzing cash flow. Output insights and forecasts.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Cash Flow Analysis`,
      analysis,
      { projectId, months: Object.keys(monthlyFlow).length },
      ['Extend runway', 'Accelerate receivables', 'Delay non-critical expenses'],
      monthlyFlow[Object.keys(monthlyFlow).pop()!]?.net < 0 ? 'high' : 'medium'
    );

    return {
      success: true,
      output: { analysis, monthlyFlow },
      metrics: { currentMonthNet: monthlyFlow[Object.keys(monthlyFlow).pop()!]?.net || 0 },
      recommendations: ['Extend runway', 'Accelerate receivables', 'Delay non-critical expenses'],
    };
  }
}
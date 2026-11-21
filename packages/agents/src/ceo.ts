import { z } from 'zod';
import { BaseAgent, AgentContext, AgentResult } from './base';
import {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  agentLogger,
  type BusinessProject,
  type BusinessOpportunity,
  type CrmDeal,
  type Agent,
} from '@abos/core';

const StrategicPlanSchema = z.object({
  vision: z.string(),
  mission: z.string(),
  objectives: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    timeline: z.string(),
    metrics: z.array(z.string()),
    owner: z.string(),
  })),
  keyResults: z.array(z.object({
    objectiveId: z.string(),
    metric: z.string(),
    target: z.string(),
    deadline: z.string(),
  })),
  risks: z.array(z.object({
    description: z.string(),
    likelihood: z.enum(['high', 'medium', 'low']),
    impact: z.enum(['high', 'medium', 'low']),
    mitigation: z.string(),
  })),
});

const DailyReportSchema = z.object({
  summary: z.string(),
  agentStatuses: z.array(z.object({
    agent: z.string(),
    status: z.string(),
    lastRun: z.string().optional(),
    nextRun: z.string().optional(),
    issues: z.array(z.string()).optional(),
  })),
  completedTasks: z.number(),
  pendingTasks: z.number(),
  keyMetrics: z.record(z.unknown()),
  alerts: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export class CEOAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    await this.updateAgentStatus('running');
    await this.logActivity('ceo_execution_started', { taskType: context.task?.type });

    try {
      const taskType = context.task?.type || 'daily-review';

      let result: AgentResult;

      switch (taskType) {
        case 'strategic-plan':
          result = await this.createStrategicPlan(context);
          break;
        case 'daily-review':
          result = await this.performDailyReview(context);
          break;
        case 'delegate-tasks':
          result = await this.delegateTasks(context);
          break;
        case 'evaluate-opportunity':
          result = await this.evaluateOpportunity(context);
          break;
        case 'weekly-review':
          result = await this.performWeeklyReview(context);
          break;
        default:
          result = await this.performDailyReview(context);
      }

      await this.updateAgentStatus('completed');
      await this.logActivity('ceo_execution_completed', { taskType, success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateAgentStatus('error', errorMessage);
      await this.logActivity('ceo_execution_failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async createStrategicPlan(context: AgentContext): Promise<AgentResult> {
    const projects = await listEntities('businessProject', { where: { status: 'active' } });
    const opportunities = await listEntities('businessOpportunity', { where: { status: 'selected' } });
    const agents = await listEntities('agent');

    const prompt = `You are the CEO Agent of an autonomous business operating system. Create a strategic plan based on the current state.

Current Projects: ${JSON.stringify(projects.slice(0, 5), null, 2)}
Selected Opportunities: ${JSON.stringify(opportunities.slice(0, 3), null, 2)}
Active Agents: ${agents.map(a => `${a.name} (${a.type})`).join(', ')}

Create a comprehensive strategic plan with vision, mission, objectives, key results, and risks. Focus on actionable, measurable goals.`;

    const plan = await this.callLLM(
      [
        { role: 'system', content: 'You are a strategic CEO creating business plans. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      { schema: StrategicPlanSchema.shape }
    );

    const parsedPlan = JSON.parse(plan) as z.infer<typeof StrategicPlanSchema>;

    // Store the strategic plan
    await createEntity('agentReport', {
      agentId: this.agent.id,
      type: 'ad-hoc',
      title: 'Strategic Plan',
      content: JSON.stringify(parsedPlan, null, 2),
      metrics: { objectivesCount: parsedPlan.objectives.length },
      recommendations: parsedPlan.objectives.map(o => o.title),
      priority: 'high',
    });

    return {
      success: true,
      output: { plan: parsedPlan },
      metrics: { objectivesCount: parsedPlan.objectives.length },
      recommendations: parsedPlan.objectives.map(o => o.title),
    };
  }

  private async performDailyReview(context: AgentContext): Promise<AgentResult> {
    const agents = await listEntities('agent');
    const tasks = await listEntities('task', { where: { status: 'pending' } });
    const runningTasks = await listEntities('task', { where: { status: 'running' } });
    const completedToday = await listEntities<{ id: string; completedAt?: string }>('task', {
      where: { status: 'completed' },
    }).then(t => t.filter(t => t.completedAt && new Date(t.completedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)));

    const agentStatuses = agents.map(a => ({
      agent: a.name,
      status: a.status,
      lastRun: a.lastRunAt,
      nextRun: a.nextRunAt,
      issues: a.lastError ? [a.lastError] : [],
    }));

    const prompt = `Generate a daily CEO report based on the current system state.

Agent Statuses: ${JSON.stringify(agentStatuses, null, 2)}
Pending Tasks: ${tasks.length}
Running Tasks: ${runningTasks.length}
Completed Today: ${completedToday.length}

Provide a concise summary, key metrics, any alerts, and recommendations for the day.`;

    const report = await this.callLLM(
      [
        { role: 'system', content: 'You are a CEO generating daily reports. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      { schema: DailyReportSchema.shape }
    );

    const parsedReport = JSON.parse(report) as z.infer<typeof DailyReportSchema>;

    await this.report(
      'daily',
      `Daily Report - ${new Date().toLocaleDateString()}`,
      JSON.stringify(parsedReport, null, 2),
      { ...parsedReport.keyMetrics, completedTasks: completedToday.length, pendingTasks: tasks.length },
      parsedReport.recommendations,
      parsedReport.alerts.length > 0 ? 'high' : 'medium'
    );

    return {
      success: true,
      output: { report: parsedReport },
      metrics: { completedTasks: completedToday.length, pendingTasks: tasks.length },
      recommendations: parsedReport.recommendations,
    };
  }

  private async performWeeklyReview(context: AgentContext): Promise<AgentResult> {
    const projects = await listEntities<BusinessProject>('businessProject');
    const opportunities = await listEntities<BusinessOpportunity>('businessOpportunity');
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
    }>( 'financialTransaction' );
    const deals = await listEntities<CrmDeal>('crmDeal');
    const reports = await listEntities('agentReport', { where: { type: 'daily' } });

    const revenue = transactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    const prompt = `Generate a weekly business review.

Projects: ${projects.length} (${projects.filter(p => p.status === 'active').length} active)
Opportunities: ${opportunities.length} (${opportunities.filter(o => o.status === 'selected').length} selected)
Revenue: $${revenue.toLocaleString()}
Expenses: $${expenses.toLocaleString()}
Profit: $${(revenue - expenses).toLocaleString()}
Deals: ${deals.length} (${deals.filter(d => d.stage === 'closed-won').length} won, ${deals.filter(d => d.stage === 'closed-lost').length} lost)

Provide strategic analysis, performance assessment, and recommendations for the coming week.`;

    const review = await this.callLLM([
      { role: 'system', content: 'You are a CEO conducting weekly business reviews. Output valid JSON with analysis, metrics, and recommendations.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'weekly',
      `Weekly Review - Week of ${new Date().toLocaleDateString()}`,
      review,
      { revenue, expenses, profit: revenue - expenses, projects: projects.length, deals: deals.length },
      ['Continue current trajectory', 'Investigate new opportunities'],
      'medium'
    );

    return {
      success: true,
      output: { review },
      metrics: { revenue, expenses, profit: revenue - expenses },
      recommendations: ['Continue current trajectory', 'Investigate new opportunities'],
    };
  }

  private async delegateTasks(context: AgentContext): Promise<AgentResult> {
    const pendingTasks = await listEntities('task', { where: { status: 'pending' } });
    const agents = await listEntities<Agent>('agent', { where: { status: 'idle' } });

    if (pendingTasks.length === 0 || agents.length === 0) {
      return { success: true, output: { delegated: 0 }, metrics: { delegated: 0 } };
    }

    let delegated = 0;
    for (const task of pendingTasks.slice(0, agents.length)) {
      const suitableAgent = agents.find(a => this.isAgentSuitableForTask(a.type, task.type as string));
      if (suitableAgent) {
        await updateEntity('task', task.id as string, {
          agentId: suitableAgent.id,
          status: 'queued',
        });
        delegated++;
      }
    }

    return {
      success: true,
      output: { delegated },
      metrics: { delegated },
    };
  }

  private isAgentSuitableForTask(agentType: string, taskType: string): boolean {
    const suitability: Record<string, string[]> = {
      ceo: ['strategic-plan', 'daily-review', 'weekly-review', 'evaluate-opportunity'],
      'market-research': ['market-research', 'competitor-analysis', 'opportunity-discovery', 'demand-validation'],
      product: ['product-design', 'pricing-analysis', 'feature-planning', 'mvp-spec'],
      development: ['website-build', 'code-review', 'deployment', 'bug-fix', 'testing'],
      marketing: ['content-creation', 'campaign-planning', 'seo-optimization', 'social-media'],
      sales: ['lead-research', 'outreach', 'crm-update', 'deal-tracking', 'proposal-generation'],
      operations: ['customer-support', 'order-processing', 'documentation', 'process-optimization'],
      finance: ['financial-reporting', 'expense-tracking', 'margin-analysis', 'budget-planning'],
    };
    return suitability[agentType]?.includes(taskType) || false;
  }

  private async evaluateOpportunity(context: AgentContext): Promise<AgentResult> {
    const opportunityId = context.task?.payload?.opportunityId as string;
    if (!opportunityId) {
      return { success: false, error: 'No opportunity ID provided' };
    }

    const opportunity = await getEntity('businessOpportunity', opportunityId);
    if (!opportunity) {
      return { success: false, error: 'Opportunity not found' };
    }

    const prompt = `Evaluate this business opportunity and provide a go/no-go recommendation with detailed reasoning.

Opportunity: ${JSON.stringify(opportunity, null, 2)}

Consider: market demand, competition, startup costs, profitability, scalability, risks.
Output a recommendation with score (0-100), go/no-go decision, and reasoning.`;

    const evaluation = await this.callLLM([
      { role: 'system', content: 'You are a CEO evaluating business opportunities. Output JSON with recommendation, score, decision, and reasoning.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Opportunity Evaluation: ${opportunity.name}`,
      evaluation,
      { opportunityId, score: opportunity.score },
      ['Proceed with validation' , 'Reject and archive'],
      'high'
    );

    return {
      success: true,
      output: { evaluation },
      metrics: { opportunityScore: opportunity.score },
      recommendations: ['Proceed with validation', 'Reject and archive'],
    };
  }
}
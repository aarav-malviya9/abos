import { z } from 'zod';
import { BaseAgent, AgentContext, AgentResult } from './base';
import {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  agentLogger,
} from '@abos/core';

const ContentPlanSchema = z.object({
  strategy: z.string(),
  channels: z.array(z.string()),
  contentCalendar: z.array(z.object({
    week: z.number(),
    topic: z.string(),
    type: z.string(),
    channel: z.string(),
    keywords: z.array(z.string()).optional(),
  })),
  seoStrategy: z.object({
    targetKeywords: z.array(z.string()),
    contentPillars: z.array(z.string()),
    linkBuilding: z.array(z.string()),
  }),
  metrics: z.object({
    targetTraffic: z.number(),
    targetLeads: z.number(),
    targetConversionRate: z.number(),
  }),
});

export class MarketingAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    await this.updateAgentStatus('running');
    await this.logActivity('marketing_agent_started', { taskType: context.task?.type });

    try {
      const taskType = context.task?.type || 'create-strategy';

      let result: AgentResult;

      switch (taskType) {
        case 'create-strategy':
          result = await this.createStrategy(context);
          break;
        case 'create-content':
          result = await this.createContent(context);
          break;
        case 'plan-campaign':
          result = await this.planCampaign(context);
          break;
        case 'seo-optimize':
          result = await this.seoOptimize(context);
          break;
        case 'analyze-performance':
          result = await this.analyzePerformance(context);
          break;
        default:
          result = await this.createStrategy(context);
      }

      await this.updateAgentStatus('completed');
      await this.logActivity('marketing_agent_completed', { taskType, success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateAgentStatus('error', errorMessage);
      await this.logActivity('marketing_agent_failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async createStrategy(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const prompt = `Create a comprehensive marketing strategy for this business.

Project: ${JSON.stringify(project, null, 2)}

Include:
1. Overall strategy and positioning
2. Target channels (organic, paid, social, email, etc.)
3. 4-week content calendar
4. SEO strategy with target keywords
5. Key metrics and targets
6. Budget allocation (free/low-cost focus)

Output valid JSON only.`;

    const strategy = await this.callLLM(
      [
        { role: 'system', content: 'You are a Marketing Strategist. Output valid JSON only. Focus on free/low-cost channels.' },
        { role: 'user', content: prompt },
      ],
      { schema: ContentPlanSchema.shape }
    );

    const parsedStrategy = JSON.parse(strategy) as z.infer<typeof ContentPlanSchema>;

    // Create marketing content entries for the calendar
    for (const item of parsedStrategy.contentCalendar) {
      await createEntity('marketingContent', {
        projectId,
        type: item.type as any,
        title: item.topic,
        content: `Content for: ${item.topic}`,
        status: 'draft',
        platform: item.channel,
        scheduledAt: new Date(Date.now() + item.week * 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    await updateEntity('businessProject', projectId, {
      brandData: {
        ...(project.brandData as Record<string, unknown>),
        marketingStrategy: parsedStrategy,
      },
    });

    await this.report(
      'ad-hoc',
      `Marketing Strategy: ${project.name}`,
      JSON.stringify(parsedStrategy, null, 2),
      { projectId, contentPieces: parsedStrategy.contentCalendar.length },
      ['Begin content creation', 'Set up analytics tracking', 'Launch first campaign'],
      'high'
    );

    return {
      success: true,
      output: { strategy: parsedStrategy },
      metrics: { contentPieces: parsedStrategy.contentCalendar.length },
      recommendations: ['Begin content creation', 'Set up analytics tracking', 'Launch first campaign'],
    };
  }

  private async createContent(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    const contentType = context.task?.payload?.contentType as string || 'blog';
    const topic = context.task?.payload?.topic as string;

    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const prompt = `Create ${contentType} content for this business.

Project: ${JSON.stringify(project, null, 2)}
Topic: ${topic || 'General business introduction'}
Type: ${contentType}

Write engaging, SEO-optimized content with clear value proposition.
Include: headline, body, call-to-action, meta description.`;

    const content = await this.callLLM([
      { role: 'system', content: 'You are a Content Writer. Output the content directly, not JSON.' },
      { role: 'user', content: prompt },
    ]);

    const contentEntry = await createEntity('marketingContent', {
      projectId,
      type: contentType as any,
      title: topic || `${contentType} content`,
      content,
      status: 'draft',
      platform: context.task?.payload?.platform as string || 'website',
    });

    await this.report(
      'ad-hoc',
      `Content Created: ${contentEntry.title}`,
      content,
      { projectId, contentId: contentEntry.id },
      ['Review and approve', 'Schedule for publishing'],
      'medium'
    );

    return {
      success: true,
      output: { content, contentId: contentEntry.id },
      metrics: {},
      recommendations: ['Review and approve', 'Schedule for publishing'],
    };
  }

  private async planCampaign(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const prompt = `Plan a marketing campaign for this business.

Project: ${JSON.stringify(project, null, 2)}

Campaign goal: ${context.task?.payload?.goal || 'Lead generation'}
Budget: Free/low-cost only
Duration: 2 weeks

Output campaign plan with: objectives, channels, timeline, assets needed, success metrics.`;

    const campaign = await this.callLLM([
      { role: 'system', content: 'You are a Campaign Manager. Output structured JSON.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Campaign Plan`,
      campaign,
      { projectId },
      ['Execute campaign', 'Monitor daily', 'Optimize based on results'],
      'high'
    );

    return {
      success: true,
      output: { campaign },
      metrics: {},
      recommendations: ['Execute campaign', 'Monitor daily', 'Optimize based on results'],
    };
  }

  private async seoOptimize(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const prompt = `Analyze SEO opportunities for this business.

Project: ${JSON.stringify(project, null, 2)}

Provide: technical SEO checklist, on-page optimization, content gaps, keyword opportunities, link building tactics (white hat only).`;

    const seo = await this.callLLM([
      { role: 'system', content: 'You are an SEO Expert. Output actionable recommendations.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `SEO Analysis`,
      seo,
      { projectId },
      ['Implement technical fixes', 'Create content for target keywords', 'Build authority'],
      'medium'
    );

    return {
      success: true,
      output: { seo },
      metrics: {},
      recommendations: ['Implement technical fixes', 'Create content for target keywords', 'Build authority'],
    };
  }

  private async analyzePerformance(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const content = await listEntities('marketingContent', { where: { projectId } });

    const prompt = `Analyze marketing performance for this project.

Content pieces: ${content.length}
Published: ${content.filter(c => c.status === 'published').length}
Draft: ${content.filter(c => c.status === 'draft').length}

Provide insights and recommendations for improvement.`;

    const analysis = await this.callLLM([
      { role: 'system', content: 'You are a Marketing Analyst. Output insights and recommendations.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Performance Analysis`,
      analysis,
      { projectId, totalContent: content.length },
      ['Double down on top performers', 'Improve underperformers', 'Test new formats'],
      'medium'
    );

    return {
      success: true,
      output: { analysis },
      metrics: { totalContent: content.length },
      recommendations: ['Double down on top performers', 'Improve underperformers', 'Test new formats'],
    };
  }
}
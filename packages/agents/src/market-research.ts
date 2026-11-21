import { z } from 'zod';
import { BaseAgent, AgentContext, AgentResult } from './base';
import {
  createEntity,
  listEntities,
  updateEntity,
  agentLogger,
} from '@abos/core';

const OpportunitySchema = z.object({
  name: z.string(),
  model: z.string(),
  description: z.string(),
  score: z.number().min(0).max(100),
  estimatedMonthlyRevenue: z.number(),
  startupCost: z.number(),
  competition: z.enum(['low', 'medium', 'high']),
  demand: z.enum(['low', 'medium', 'high']),
  targetAudience: z.string(),
  valueProposition: z.string(),
  keyMetrics: z.record(z.unknown()),
  risks: z.array(z.string()),
  validationApproach: z.string(),
});

export class MarketResearchAgent extends BaseAgent {
  private readonly BUSINESS_MODELS = [
    'SaaS / Micro-SaaS',
    'Content / Affiliate',
    'E-commerce / Digital Products',
    'Services / Agency',
    'Marketplace / Platform',
    'Subscription Box',
    'Online Course / Education',
    'Newsletter / Media',
    'Tool / Utility',
    'Community / Membership',
  ];

  async execute(context: AgentContext): Promise<AgentResult> {
    await this.updateAgentStatus('running');
    await this.logActivity('market_research_started', { taskType: context.task?.type });

    try {
      const taskType = context.task?.type || 'discover-opportunities';

      let result: AgentResult;

      switch (taskType) {
        case 'discover-opportunities':
          result = await this.discoverOpportunities(context);
          break;
        case 'competitor-analysis':
          result = await this.analyzeCompetitors(context);
          break;
        case 'demand-validation':
          result = await this.validateDemand(context);
          break;
        case 'market-sizing':
          result = await this.sizeMarket(context);
          break;
        default:
          result = await this.discoverOpportunities(context);
      }

      await this.updateAgentStatus('completed');
      await this.logActivity('market_research_completed', { taskType, success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateAgentStatus('error', errorMessage);
      await this.logActivity('market_research_failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async discoverOpportunities(context: AgentContext): Promise<AgentResult> {
    const existingOpportunities = await listEntities('businessOpportunity');
    const count = existingOpportunities.length;

    // Research at least 10 business models if we have fewer than 10
    const targetCount = Math.max(10 - count, 3);

    const prompt = `You are a Market Research Agent. Discover ${targetCount} new business opportunities across different models.

Business models to explore: ${this.BUSINESS_MODELS.join(', ')}

For each opportunity, provide:
1. Name and model type
2. Description
3. Target audience
4. Value proposition
5. Estimated monthly revenue (realistic, not fabricated)
6. Startup cost
7. Competition level (low/medium/high)
8. Demand level (low/medium/high)
9. Key metrics to track
10. Risks
11. Validation approach

Score each 0-100 based on: Demand (30%), Competition (20%), Cost (20%), Margin (15%), Scalability (15%).
Only include opportunities with score >= 60.
Output valid JSON array only.`;

    const response = await this.callLLM(
      [
        { role: 'system', content: 'You are a market research expert. Output valid JSON array of opportunities only. Be realistic with numbers - no fabricated testimonials or fake revenue claims.' },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 6000 }
    );

    try {
      const opportunities = JSON.parse(response) as z.infer<typeof OpportunitySchema>[];
      let created = 0;

      for (const opp of opportunities) {
        if (opp.score >= 60) {
          await createEntity('businessOpportunity', {
            name: opp.name,
            model: opp.model,
            description: opp.description,
            score: opp.score,
            status: 'researching',
            researchData: {
              targetAudience: opp.targetAudience,
              valueProposition: opp.valueProposition,
              estimatedMonthlyRevenue: opp.estimatedMonthlyRevenue,
              startupCost: opp.startupCost,
              competition: opp.competition,
              demand: opp.demand,
              keyMetrics: opp.keyMetrics,
              risks: opp.risks,
              validationApproach: opp.validationApproach,
            },
          });
          created++;
        }
      }

      await this.report(
        'ad-hoc',
        `Discovered ${created} new opportunities`,
        `Found ${opportunities.length} potential opportunities, created ${created} with score >= 60`,
        { opportunitiesFound: opportunities.length, opportunitiesCreated: created },
        opportunities.filter(o => o.score >= 60).map(o => `${o.name} (${o.score})`),
        'medium'
      );

      return {
        success: true,
        output: { opportunities, created },
        metrics: { opportunitiesFound: opportunities.length, opportunitiesCreated: created },
        recommendations: opportunities.filter(o => o.score >= 60).map(o => `${o.name} (${o.score})`),
      };
    } catch (error) {
      agentLogger.error({ error, response }, 'Failed to parse opportunities');
      return { success: false, error: 'Failed to parse LLM response' };
    }
  }

  private async analyzeCompetitors(context: AgentContext): Promise<AgentResult> {
    const opportunityId = context.task?.payload?.opportunityId as string;
    if (!opportunityId) {
      return { success: false, error: 'No opportunity ID provided' };
    }

    // In a real implementation, this would use web search APIs
    // For now, generate competitor analysis via LLM
    const prompt = `Analyze competitors for a business opportunity. Provide realistic competitor landscape analysis.

Focus on: direct competitors, indirect competitors, market leaders, their strengths/weaknesses, pricing, positioning.
Output structured analysis.`;

    const analysis = await this.callLLM([
      { role: 'system', content: 'You are a competitive intelligence analyst. Output structured JSON.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Competitor Analysis`,
      analysis,
      { opportunityId },
      ['Monitor top 3 competitors weekly', 'Identify differentiation opportunities'],
      'medium'
    );

    return {
      success: true,
      output: { analysis },
      metrics: {},
      recommendations: ['Monitor top 3 competitors weekly', 'Identify differentiation opportunities'],
    };
  }

  private async validateDemand(context: AgentContext): Promise<AgentResult> {
    const opportunityId = context.task?.payload?.opportunityId as string;
    if (!opportunityId) {
      return { success: false, error: 'No opportunity ID provided' };
    }

    const opportunity = await listEntities('businessOpportunity', { where: { id: opportunityId } });
    if (opportunity.length === 0) {
      return { success: false, error: 'Opportunity not found' };
    }

    const prompt = `Design a demand validation plan for this opportunity.

Opportunity: ${JSON.stringify(opportunity[0], null, 2)}

Provide a step-by-step validation plan using free/low-cost methods:
1. Keyword research approach
2. Landing page test design
3. Ad test budget (using free credits)
4. Email capture target
5. Success criteria (quantitative)
6. Timeline

Output structured JSON with actionable steps.`;

    const validationPlan = await this.callLLM([
      { role: 'system', content: 'You are a validation expert. Output structured JSON.' },
      { role: 'user', content: prompt },
    ]);

    await updateEntity('businessOpportunity', opportunityId, {
      status: 'validating',
      validationData: { plan: validationPlan },
    });

    await this.report(
      'ad-hoc',
      `Demand Validation Plan`,
      validationPlan,
      { opportunityId },
      ['Execute validation plan', 'Review results in 2 weeks'],
      'high'
    );

    return {
      success: true,
      output: { validationPlan },
      metrics: {},
      recommendations: ['Execute validation plan', 'Review results in 2 weeks'],
    };
  }

  private async sizeMarket(context: AgentContext): Promise<AgentResult> {
    const opportunityId = context.task?.payload?.opportunityId as string;
    if (!opportunityId) {
      return { success: false, error: 'No opportunity ID provided' };
    }

    const opportunity = await listEntities('businessOpportunity', { where: { id: opportunityId } });
    if (opportunity.length === 0) {
      return { success: false, error: 'Opportunity not found' };
    }

    const prompt = `Estimate market size for this opportunity using TAM/SAM/SOM framework.

Opportunity: ${JSON.stringify(opportunity[0], null, 2)}

Provide realistic estimates with clear assumptions. Use publicly available data patterns.
Output JSON with TAM, SAM, SOM, assumptions, and methodology.`;

    const marketSize = await this.callLLM([
      { role: 'system', content: 'You are a market sizing expert. Output structured JSON with realistic estimates.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Market Sizing Analysis`,
      marketSize,
      { opportunityId },
      ['Use for financial projections', 'Validate with primary research'],
      'medium'
    );

    return {
      success: true,
      output: { marketSize },
      metrics: {},
      recommendations: ['Use for financial projections', 'Validate with primary research'],
    };
  }
}
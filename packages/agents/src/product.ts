import { z } from 'zod';
import { BaseAgent, AgentContext, AgentResult } from './base';
import {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  agentLogger,
} from '@abos/core';

const ProductSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  features: z.array(z.object({
    name: z.string(),
    description: z.string(),
    priority: z.enum(['must-have', 'should-have', 'nice-to-have']),
    effort: z.enum(['low', 'medium', 'high']),
  })),
  pricing: z.object({
    model: z.enum(['freemium', 'subscription', 'one-time', 'usage-based', 'tiered']),
    tiers: z.array(z.object({
      name: z.string(),
      price: z.number(),
      features: z.array(z.string()),
    })).optional(),
    currency: z.string().length(3).default('USD'),
  }),
  mvpScope: z.array(z.string()),
  technicalRequirements: z.array(z.string()),
  timeline: z.object({
    design: z.string(),
    development: z.string(),
    testing: z.string(),
    launch: z.string(),
  }),
});

export class ProductAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    await this.updateAgentStatus('running');
    await this.logActivity('product_agent_started', { taskType: context.task?.type });

    try {
      const taskType = context.task?.type || 'design-product';

      let result: AgentResult;

      switch (taskType) {
        case 'design-product':
          result = await this.designProduct(context);
          break;
        case 'pricing-analysis':
          result = await this.analyzePricing(context);
          break;
        case 'mvp-spec':
          result = await this.createMVPSpec(context);
          break;
        case 'feature-planning':
          result = await this.planFeatures(context);
          break;
        default:
          result = await this.designProduct(context);
      }

      await this.updateAgentStatus('completed');
      await this.logActivity('product_agent_completed', { taskType, success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateAgentStatus('error', errorMessage);
      await this.logActivity('product_agent_failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async designProduct(context: AgentContext): Promise<AgentResult> {
    const opportunityId = context.task?.payload?.opportunityId as string;
    if (!opportunityId) {
      return { success: false, error: 'No opportunity ID provided' };
    }

    const opportunity = await getEntity('businessOpportunity', opportunityId);
    if (!opportunity) {
      return { success: false, error: 'Opportunity not found' };
    }

    const prompt = `Design a product for this validated business opportunity.

Opportunity: ${JSON.stringify(opportunity, null, 2)}

Create a comprehensive product specification including:
1. Product name and description
2. Core features (prioritized: must-have, should-have, nice-to-have)
3. Pricing model and tiers
4. MVP scope
5. Technical requirements
6. Timeline estimates

Be specific and actionable. Output valid JSON only.`;

    const spec = await this.callLLM(
      [
        { role: 'system', content: 'You are a Product Manager designing SaaS/digital products. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      { schema: ProductSpecSchema.shape }
    );

    const parsedSpec = JSON.parse(spec) as z.infer<typeof ProductSpecSchema>;

    // Create a project for this opportunity
    const project = await createEntity('businessProject', {
      opportunityId,
      name: parsedSpec.name,
      status: 'planning',
      brandData: {
        productSpec: parsedSpec,
      },
    });

    // Update opportunity status
    await updateEntity('businessOpportunity', opportunityId, {
      status: 'selected',
      selectedAt: new Date().toISOString(),
    });

    await this.report(
      'ad-hoc',
      `Product Design: ${parsedSpec.name}`,
      JSON.stringify(parsedSpec, null, 2),
      { projectId: project.id, featuresCount: parsedSpec.features.length },
      ['Begin MVP development', 'Validate pricing with target users'],
      'high'
    );

    return {
      success: true,
      output: { spec: parsedSpec, projectId: project.id },
      metrics: { featuresCount: parsedSpec.features.length },
      recommendations: ['Begin MVP development', 'Validate pricing with target users'],
    };
  }

  private async analyzePricing(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const prompt = `Analyze pricing strategy for this product.

Project: ${JSON.stringify(project, null, 2)}

Consider: competitor pricing, value-based pricing, psychological pricing, tier structure.
Recommend optimal pricing with justification.`;

    const analysis = await this.callLLM([
      { role: 'system', content: 'You are a pricing strategist. Output structured analysis.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Pricing Analysis`,
      analysis,
      { projectId },
      ['Test pricing with landing page', 'Monitor conversion rates'],
      'medium'
    );

    return {
      success: true,
      output: { analysis },
      metrics: {},
      recommendations: ['Test pricing with landing page', 'Monitor conversion rates'],
    };
  }

  private async createMVPSpec(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const brandData = project.brandData as Record<string, unknown>;
    const productSpec = brandData.productSpec as Record<string, unknown> | undefined;

    const prompt = `Create a detailed MVP specification for development.

Product: ${JSON.stringify(productSpec || project, null, 2)}

Provide:
1. Exact features for MVP (subset of full spec)
2. Technical architecture decisions
3. Database schema
4. API endpoints needed
5. UI/UX requirements
6. Acceptance criteria
7. Definition of done

Output structured JSON for the Development Agent to execute.`;

    const mvpSpec = await this.callLLM([
      { role: 'system', content: 'You are a Product Manager creating MVP specs for developers. Output detailed, actionable JSON.' },
      { role: 'user', content: prompt },
    ]);

    // Update project with MVP spec
    await updateEntity('businessProject', projectId, {
      brandData: {
        ...brandData,
        mvpSpec: mvpSpec,
      },
      status: 'building',
    });

    // Create development tasks
    const mvp = JSON.parse(mvpSpec);
    if (mvpSpec && typeof mvpSpec === 'string') {
      // Already parsed
    }

    await this.report(
      'ad-hoc',
      `MVP Specification Ready`,
      mvpSpec,
      { projectId },
      ['Assign to Development Agent', 'Begin sprint planning'],
      'high'
    );

    return {
      success: true,
      output: { mvpSpec: JSON.parse(mvpSpec) },
      metrics: {},
      recommendations: ['Assign to Development Agent', 'Begin sprint planning'],
    };
  }

  private async planFeatures(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const prompt = `Plan feature roadmap for the next 3 months.

Project: ${JSON.stringify(project, null, 2)}

Prioritize features by: user impact, development effort, revenue potential.
Output quarterly roadmap with milestones.`;

    const roadmap = await this.callLLM([
      { role: 'system', content: 'You are a Product Manager creating feature roadmaps. Output structured JSON.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Feature Roadmap`,
      roadmap,
      { projectId },
      ['Review with CEO Agent', 'Align with development capacity'],
      'medium'
    );

    return {
      success: true,
      output: { roadmap },
      metrics: {},
      recommendations: ['Review with CEO Agent', 'Align with development capacity'],
    };
  }
}
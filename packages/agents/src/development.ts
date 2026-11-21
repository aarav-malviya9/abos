import { z } from 'zod';
import { BaseAgent, AgentContext, AgentResult } from './base';
import {
  createEntity,
  getEntity,
  updateEntity,
  agentLogger,
} from '@abos/core';

const BuildPlanSchema = z.object({
  steps: z.array(z.object({
    name: z.string(),
    description: z.string(),
    commands: z.array(z.string()),
    expectedOutput: z.string(),
    validation: z.string(),
  })),
  techStack: z.object({
    framework: z.string(),
    language: z.string(),
    database: z.string().optional(),
    hosting: z.string(),
    domain: z.string().optional(),
  }),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    description: z.string(),
  })),
});

export class DevelopmentAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    await this.updateAgentStatus('running');
    await this.logActivity('development_agent_started', { taskType: context.task?.type });

    try {
      const taskType = context.task?.type || 'build-website';

      let result: AgentResult;

      switch (taskType) {
        case 'build-website':
          result = await this.buildWebsite(context);
          break;
        case 'deploy':
          result = await this.deployWebsite(context);
          break;
        case 'code-review':
          result = await this.codeReview(context);
          break;
        case 'bug-fix':
          result = await this.fixBug(context);
          break;
        case 'testing':
          result = await this.runTests(context);
          break;
        default:
          result = await this.buildWebsite(context);
      }

      await this.updateAgentStatus('completed');
      await this.logActivity('development_agent_completed', { taskType, success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateAgentStatus('error', errorMessage);
      await this.logActivity('development_agent_failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async buildWebsite(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const brandData = project.brandData as Record<string, unknown>;
    const mvpSpec = brandData.mvpSpec as string | undefined;

    const prompt = `Build a complete website for this project. Generate all necessary files.

Project: ${JSON.stringify(project, null, 2)}
MVP Spec: ${mvpSpec || 'Not provided - create a professional landing page'}

Create a Next.js 14+ project with:
1. App Router structure
2. Tailwind CSS (dark theme)
3. Responsive landing page
4. SEO optimization
5. Performance optimized
6. Ready for Cloudflare Pages deployment

Output a build plan with all files needed.`;

    const plan = await this.callLLM(
      [
        { role: 'system', content: 'You are a Senior Full-Stack Developer. Output valid JSON with complete build plan and file contents.' },
        { role: 'user', content: prompt },
      ],
      { schema: BuildPlanSchema.shape, maxTokens: 8000 }
    );

    const parsedPlan = JSON.parse(plan) as z.infer<typeof BuildPlanSchema>;

    // In a real implementation, this would write files to disk
    // For now, store the build plan in the project
    await updateEntity('businessProject', projectId, {
      brandData: {
        ...brandData,
        buildPlan: parsedPlan,
        techStack: parsedPlan.techStack,
      },
      status: 'building',
    });

    await this.report(
      'ad-hoc',
      `Build Plan: ${project.name}`,
      JSON.stringify(parsedPlan, null, 2),
      { projectId, filesCount: parsedPlan.files.length, stepsCount: parsedPlan.steps.length },
      ['Execute build steps', 'Deploy to Cloudflare Pages'],
      'high'
    );

    return {
      success: true,
      output: { plan: parsedPlan, projectId },
      metrics: { filesCount: parsedPlan.files.length, stepsCount: parsedPlan.steps.length },
      recommendations: ['Execute build steps', 'Deploy to Cloudflare Pages'],
    };
  }

  private async deployWebsite(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // In a real implementation, this would:
    // 1. Build the Next.js app
    // 2. Deploy to Cloudflare Pages via API
    // 3. Configure custom domain
    // 4. Set up analytics

    const prompt = `Create a deployment checklist and script for Cloudflare Pages.

Project: ${JSON.stringify(project, null, 2)}

Provide step-by-step deployment commands and configuration.`;

    const deploymentGuide = await this.callLLM([
      { role: 'system', content: 'You are a DevOps engineer. Output practical deployment steps.' },
      { role: 'user', content: prompt },
    ]);

    await updateEntity('businessProject', projectId, {
      brandData: {
        ...(project.brandData as Record<string, unknown>),
        deploymentGuide,
      },
      status: 'launching',
    });

    await this.report(
      'ad-hoc',
      `Deployment Guide: ${project.name}`,
      deploymentGuide,
      { projectId },
      ['Execute deployment', 'Verify live site', 'Configure analytics'],
      'high'
    );

    return {
      success: true,
      output: { deploymentGuide },
      metrics: {},
      recommendations: ['Execute deployment', 'Verify live site', 'Configure analytics'],
    };
  }

  private async codeReview(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const prompt = `Perform a code review for a Next.js/TypeScript project.
Focus on: type safety, performance, security, accessibility, best practices.
Output structured review with issues and recommendations.`;

    const review = await this.callLLM([
      { role: 'system', content: 'You are a Senior Developer doing code review. Output structured JSON.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Code Review`,
      review,
      { projectId },
      ['Fix critical issues', 'Address warnings'],
      'medium'
    );

    return {
      success: true,
      output: { review },
      metrics: {},
      recommendations: ['Fix critical issues', 'Address warnings'],
    };
  }

  private async fixBug(context: AgentContext): Promise<AgentResult> {
    const bugDescription = context.task?.payload?.bugDescription as string;
    if (!bugDescription) {
      return { success: false, error: 'No bug description provided' };
    }

    const prompt = `Analyze and provide a fix for this bug.

Bug: ${bugDescription}

Provide root cause analysis, fix, and prevention steps.`;

    const fix = await this.callLLM([
      { role: 'system', content: 'You are a debugging expert. Output structured fix with explanation.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Bug Fix`,
      fix,
      { bugDescription: bugDescription.slice(0, 100) },
      ['Apply fix', 'Test thoroughly', 'Add regression test'],
      'high'
    );

    return {
      success: true,
      output: { fix },
      metrics: {},
      recommendations: ['Apply fix', 'Test thoroughly', 'Add regression test'],
    };
  }

  private async runTests(context: AgentContext): Promise<AgentResult> {
    const prompt = `Create a test plan for a Next.js business website.

Include: unit tests, integration tests, e2e tests, accessibility tests, performance tests.
Output structured test plan with tools and commands.`;

    const testPlan = await this.callLLM([
      { role: 'system', content: 'You are a QA Engineer. Output structured test plan.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Test Plan`,
      testPlan,
      {},
      ['Implement tests', 'Add to CI pipeline'],
      'medium'
    );

    return {
      success: true,
      output: { testPlan },
      metrics: {},
      recommendations: ['Implement tests', 'Add to CI pipeline'],
    };
  }
}
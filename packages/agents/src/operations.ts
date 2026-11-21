import { z } from 'zod';
import { BaseAgent, AgentContext, AgentResult } from './base';
import {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  agentLogger,
} from '@abos/core';

export class OperationsAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    await this.updateAgentStatus('running');
    await this.logActivity('operations_agent_started', { taskType: context.task?.type });

    try {
      const taskType = context.task?.type || 'customer-support';

      let result: AgentResult;

      switch (taskType) {
        case 'customer-support':
          result = await this.handleCustomerSupport(context);
          break;
        case 'order-processing':
          result = await this.processOrders(context);
          break;
        case 'documentation':
          result = await this.maintainDocumentation(context);
          break;
        case 'process-optimization':
          result = await this.optimizeProcesses(context);
          break;
        case 'website-monitoring':
          result = await this.monitorWebsite(context);
          break;
        default:
          result = await this.handleCustomerSupport(context);
      }

      await this.updateAgentStatus('completed');
      await this.logActivity('operations_agent_completed', { taskType, success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateAgentStatus('error', errorMessage);
      await this.logActivity('operations_agent_failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async handleCustomerSupport(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    // Check for unresponded contacts
    const contacts = await listEntities('crmContact', {
      where: { projectId, status: 'contacted' },
    });

    const prompt = `Handle customer support for this business.

Project ID: ${projectId}
Recent contacts needing response: ${contacts.length}

Provide: response templates, escalation criteria, FAQ updates, support process improvements.`;

    const support = await this.callLLM([
      { role: 'system', content: 'You are a Customer Support Manager. Output actionable support guidance.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Customer Support Report`,
      support,
      { projectId, pendingContacts: contacts.length },
      ['Respond to pending contacts', 'Update FAQ', 'Review response times'],
      'medium'
    );

    return {
      success: true,
      output: { support },
      metrics: { pendingContacts: contacts.length },
      recommendations: ['Respond to pending contacts', 'Update FAQ', 'Review response times'],
    };
  }

  private async processOrders(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const deals = await listEntities('crmDeal', {
      where: { projectId, stage: 'closed-won' },
    });

    const prompt = `Process fulfilled orders for this business.

Closed-won deals: ${deals.length}

Provide: fulfillment checklist, delivery confirmation process, post-purchase workflow, feedback collection.`;

    const fulfillment = await this.callLLM([
      { role: 'system', content: 'You are an Operations Manager. Output structured fulfillment process.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Order Processing`,
      fulfillment,
      { projectId, ordersToProcess: deals.length },
      ['Confirm deliveries', 'Request feedback', 'Update CRM'],
      'medium'
    );

    return {
      success: true,
      output: { fulfillment },
      metrics: { ordersToProcess: deals.length },
      recommendations: ['Confirm deliveries', 'Request feedback', 'Update CRM'],
    };
  }

  private async maintainDocumentation(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const prompt = `Maintain operational documentation for this business.

Project: ${JSON.stringify(project, null, 2)}

Identify needed documentation: SOPs, runbooks, onboarding guides, troubleshooting guides, API docs.
Output documentation plan with priorities.`;

    const docs = await this.callLLM([
      { role: 'system', content: 'You are a Technical Writer. Output documentation plan.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Documentation Plan`,
      docs,
      { projectId },
      ['Create SOPs for top 3 processes', 'Document deployment process', 'Create onboarding guide'],
      'medium'
    );

    return {
      success: true,
      output: { docs },
      metrics: {},
      recommendations: ['Create SOPs for top 3 processes', 'Document deployment process', 'Create onboarding guide'],
    };
  }

  private async optimizeProcesses(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const automationRuns = await listEntities('automationRun', { where: { workflowName: 'daily-ceo-report' } });

    const prompt = `Analyze operational processes for optimization.

Recent automation runs: ${automationRuns.length}
Project ID: ${projectId}

Identify bottlenecks, automation opportunities, quality issues, and efficiency gains.
Output prioritized optimization recommendations.`;

    const optimization = await this.callLLM([
      { role: 'system', content: 'You are a Process Improvement Specialist. Output actionable optimizations.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Process Optimization`,
      optimization,
      { projectId },
      ['Automate repetitive tasks', 'Reduce manual handoffs', 'Improve monitoring'],
      'medium'
    );

    return {
      success: true,
      output: { optimization },
      metrics: {},
      recommendations: ['Automate repetitive tasks', 'Reduce manual handoffs', 'Improve monitoring'],
    };
  }

  private async monitorWebsite(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project || !project.websiteUrl) {
      return { success: false, error: 'No website URL configured' };
    }

    const prompt = `Create website monitoring checklist for: ${project.websiteUrl}

Include: uptime monitoring, performance metrics, content freshness, SEO health, security checks, analytics verification.
Output structured monitoring plan with tools and frequency.`;

    const monitoring = await this.callLLM([
      { role: 'system', content: 'You are a Site Reliability Engineer. Output monitoring plan.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Website Monitoring Plan`,
      monitoring,
      { projectId, websiteUrl: project.websiteUrl },
      ['Set up uptime monitoring', 'Configure performance alerts', 'Schedule content audits'],
      'medium'
    );

    return {
      success: true,
      output: { monitoring },
      metrics: {},
      recommendations: ['Set up uptime monitoring', 'Configure performance alerts', 'Schedule content audits'],
    };
  }
}
import { z } from 'zod';
import { BaseAgent, AgentContext, AgentResult } from './base';
import {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  agentLogger,
} from '@abos/core';

const OutreachTemplateSchema = z.object({
  subject: z.string(),
  body: z.string(),
  channel: z.enum(['email', 'linkedin', 'twitter', 'phone']),
  personalizationFields: z.array(z.string()),
});

export class SalesAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    await this.updateAgentStatus('running');
    await this.logActivity('sales_agent_started', { taskType: context.task?.type });

    try {
      const taskType = context.task?.type || 'research-leads';

      let result: AgentResult;

      switch (taskType) {
        case 'research-leads':
          result = await this.researchLeads(context);
          break;
        case 'create-outreach':
          result = await this.createOutreach(context);
          break;
        case 'update-crm':
          result = await this.updateCRM(context);
          break;
        case 'track-deals':
          result = await this.trackDeals(context);
          break;
        case 'prepare-proposal':
          result = await this.prepareProposal(context);
          break;
        default:
          result = await this.researchLeads(context);
      }

      await this.updateAgentStatus('completed');
      await this.logActivity('sales_agent_completed', { taskType, success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateAgentStatus('error', errorMessage);
      await this.logActivity('sales_agent_failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async researchLeads(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const project = await getEntity('businessProject', projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const prompt = `Research potential leads for this business.

Project: ${JSON.stringify(project, null, 2)}

Identify ideal customer profiles and provide lead generation strategies using free methods:
1. LinkedIn search strategies
2. Twitter/X advanced search
3. Industry directories
4. Competitor customer analysis
5. Content engagement tracking

Output structured lead profiles with: company, role, contact info sources, approach angle.`;

    const leads = await this.callLLM([
      { role: 'system', content: 'You are a Sales Development Rep. Output structured lead profiles.' },
      { role: 'user', content: prompt },
    ]);

    // Create CRM contacts from lead research
    const leadData = JSON.parse(leads);
    let created = 0;

    if (Array.isArray(leadData)) {
      for (const lead of leadData.slice(0, 20)) {
        await createEntity('crmContact', {
          projectId,
          name: lead.name || 'Unknown',
          email: lead.email,
          company: lead.company,
          role: lead.role,
          status: 'lead',
          source: lead.source || 'research',
          notes: lead.approachAngle || '',
        });
        created++;
      }
    }

    await this.report(
      'ad-hoc',
      `Lead Research: ${project.name}`,
      leads,
      { projectId, leadsFound: created },
      ['Qualify top 10 leads', 'Begin outreach sequence', 'Schedule follow-ups'],
      'high'
    );

    return {
      success: true,
      output: { leads: leadData, created },
      metrics: { leadsFound: created },
      recommendations: ['Qualify top 10 leads', 'Begin outreach sequence', 'Schedule follow-ups'],
    };
  }

  private async createOutreach(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    const contactId = context.task?.payload?.contactId as string;
    const channel = context.task?.payload?.channel as string || 'email';

    if (!projectId || !contactId) {
      return { success: false, error: 'Missing projectId or contactId' };
    }

    const project = await getEntity('businessProject', projectId);
    const contact = await getEntity('crmContact', contactId);

    if (!project || !contact) {
      return { success: false, error: 'Project or contact not found' };
    }

    const prompt = `Create personalized outreach for this lead.

Project: ${JSON.stringify(project, null, 2)}
Contact: ${JSON.stringify(contact, null, 2)}
Channel: ${channel}

Write a compelling, personalized message that demonstrates research and clear value.
Include: subject (if email), body, call-to-action.`;

    const outreach = await this.callLLM([
      { role: 'system', content: 'You are a Sales Rep writing personalized outreach. Be human, specific, and value-focused.' },
      { role: 'user', content: prompt },
    ]);

    await updateEntity('crmContact', contactId, {
      status: 'contacted',
      lastContactAt: new Date().toISOString(),
      notes: `${contact.notes || ''}\n\nOutreach sent (${channel}): ${new Date().toISOString()}`,
    });

    await this.report(
      'ad-hoc',
      `Outreach Created: ${contact.name}`,
      outreach,
      { projectId, contactId, channel },
      ['Send outreach', 'Log response', 'Schedule follow-up'],
      'high'
    );

    return {
      success: true,
      output: { outreach },
      metrics: {},
      recommendations: ['Send outreach', 'Log response', 'Schedule follow-up'],
    };
  }

  private async updateCRM(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const contacts = await listEntities('crmContact', { where: { projectId } });
    const deals = await listEntities('crmDeal', { where: { projectId } });

    const prompt = `Analyze CRM data and recommend actions.

Contacts: ${contacts.length} (${contacts.filter(c => c.status === 'lead').length} leads, ${contacts.filter(c => c.status === 'qualified').length} qualified)
Deals: ${deals.length} (${deals.filter(d => d.stage === 'proposal').length} in proposal, ${deals.filter(d => d.stage === 'negotiation').length} in negotiation)

Recommend: lead qualification criteria, deal progression actions, follow-up priorities.`;

    const analysis = await this.callLLM([
      { role: 'system', content: 'You are a CRM Manager. Output actionable recommendations.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `CRM Analysis`,
      analysis,
      { projectId, contacts: contacts.length, deals: deals.length },
      ['Qualify stale leads', 'Advance stalled deals', 'Clean up inactive contacts'],
      'medium'
    );

    return {
      success: true,
      output: { analysis },
      metrics: { contacts: contacts.length, deals: deals.length },
      recommendations: ['Qualify stale leads', 'Advance stalled deals', 'Clean up inactive contacts'],
    };
  }

  private async trackDeals(context: AgentContext): Promise<AgentResult> {
    const projectId = context.task?.payload?.projectId as string;
    if (!projectId) {
      return { success: false, error: 'No project ID provided' };
    }

    const deals = await listEntities('crmDeal', { where: { projectId } });

    const prompt = `Analyze deal pipeline and forecast.

Deals: ${JSON.stringify(deals, null, 2)}

Provide: pipeline value by stage, weighted forecast, deals at risk, recommended actions.`;

    const forecast = await this.callLLM([
      { role: 'system', content: 'You are a Sales Manager. Output pipeline analysis.' },
      { role: 'user', content: prompt },
    ]);

    await this.report(
      'ad-hoc',
      `Deal Pipeline Forecast`,
      forecast,
      { projectId, totalDeals: deals.length },
      ['Focus on closing proposals', 'Re-engage stalled negotiations', 'Qualify new opportunities'],
      'high'
    );

    return {
      success: true,
      output: { forecast },
      metrics: { totalDeals: deals.length },
      recommendations: ['Focus on closing proposals', 'Re-engage stalled negotiations', 'Qualify new opportunities'],
    };
  }

  private async prepareProposal(context: AgentContext): Promise<AgentResult> {
    const dealId = context.task?.payload?.dealId as string;
    if (!dealId) {
      return { success: false, error: 'No deal ID provided' };
    }

    const deal = await getEntity('crmDeal', dealId);
    if (!deal) {
      return { success: false, error: 'Deal not found' };
    }

    const contact = deal.contactId ? await getEntity('crmContact', deal.contactId as string) : null;
    const project = await getEntity('businessProject', deal.projectId as string);

    const prompt = `Create a proposal for this deal.

Deal: ${JSON.stringify(deal, null, 2)}
Contact: ${JSON.stringify(contact, null, 2)}
Project: ${JSON.stringify(project, null, 2)}

Create a professional proposal with: executive summary, solution, pricing, timeline, terms, next steps.`;

    const proposal = await this.callLLM([
      { role: 'system', content: 'You are a Sales Rep creating proposals. Output structured proposal.' },
      { role: 'user', content: prompt },
    ]);

    await updateEntity('crmDeal', dealId, {
      stage: 'proposal',
    });

    await this.report(
      'ad-hoc',
      `Proposal Prepared: ${deal.title}`,
      proposal,
      { dealId, projectId: deal.projectId },
      ['Review with CEO', 'Send to prospect', 'Schedule follow-up meeting'],
      'high'
    );

    return {
      success: true,
      output: { proposal },
      metrics: {},
      recommendations: ['Review with CEO', 'Send to prospect', 'Schedule follow-up meeting'],
    };
  }
}
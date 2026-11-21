import { z } from 'zod';
import {
  Agent,
  Task,
  AgentReport,
  getConfig,
  getLLMClient,
  FreeLLMClient,
  createEntity,
  getEntity,
  updateEntity,
  listEntities,
  logAudit,
  agentLogger,
} from '@abos/core';

export interface AgentContext {
  agent: Agent;
  task?: Task;
  config: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  metrics?: Record<string, unknown>;
  recommendations?: string[];
}

export abstract class BaseAgent {
  protected config: Record<string, unknown>;
  protected llm: FreeLLMClient;
  protected agentConfig = getConfig();

  constructor(protected agent: Agent) {
    this.config = agent.config || {};
    this.llm = getLLMClient();
  }

  abstract execute(context: AgentContext): Promise<AgentResult>;

  protected async createTask(
    projectId: string | undefined,
    type: string,
    title: string,
    payload: Record<string, unknown> = {},
    priority = 0
  ): Promise<Task> {
    return createEntity('task', {
      projectId,
      agentId: this.agent.id,
      type,
      title,
      payload,
      status: 'pending',
      priority,
      result: {},
      retries: 0,
      maxRetries: 3,
    });
  }

  protected async updateTaskStatus(
    taskId: string,
    status: Task['status'],
    result?: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    const updates: Partial<Task> = { status, updatedAt: new Date().toISOString() };
    if (status === 'running') updates.startedAt = new Date().toISOString();
    if (status === 'completed' || status === 'failed') updates.completedAt = new Date().toISOString();
    if (result) updates.result = result;
    if (error) updates.error = error;

    await updateEntity('task', taskId, updates);
  }

  protected async logActivity(action: string, metadata: Record<string, unknown> = {}): Promise<void> {
    logAudit({
      action,
      entityType: 'agent',
      entityId: this.agent.id,
      agentId: this.agent.id,
      metadata: {
        agentType: this.agent.type,
        ...metadata,
      },
    });
  }

  protected async report(
    type: AgentReport['type'],
    title: string,
    content: string,
    metrics: Record<string, unknown> = {},
    recommendations: string[] = [],
    priority: AgentReport['priority'] = 'medium'
  ): Promise<void> {
    await createEntity('agentReport', {
      agentId: this.agent.id,
      type,
      title,
      content,
      metrics,
      recommendations,
      priority,
    });

    agentLogger.info({ agentType: this.agent.type, reportType: type, title }, 'Agent report created');
  }

  protected async updateAgentStatus(status: Agent['status'], error?: string): Promise<void> {
    await updateEntity('agent', this.agent.id, {
      status,
      lastRunAt: new Date().toISOString(),
      lastError: error,
      runCount: this.agent.runCount + 1,
    });
  }

  protected async callLLM(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      schema?: Record<string, unknown>;
    }
  ): Promise<string> {
    try {
      if (options?.schema) {
        const result = await this.llm.completeWithSchema({
          messages,
          temperature: options.temperature ?? 0.7,
          maxTokens: options.maxTokens ?? 4000,
          schema: options.schema,
        });
        return JSON.stringify(result);
      }

      const response = await this.llm.complete({
        messages,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 4000,
      });
      return response.content;
    } catch (error) {
      agentLogger.error({ error, agentType: this.agent.type }, 'LLM call failed');
      throw error;
    }
  }

  protected async callLLMWithTools(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    tools: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>
  ): Promise<{ content: string; toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }> }> {
    const response = await this.llm.complete({
      messages,
      tools: tools.map(t => ({
        type: 'function',
        function: t,
      })),
      toolChoice: 'auto',
    });

    return {
      content: response.content,
      toolCalls: undefined, // Tool calls not implemented in mock
    };
  }
}

// Type guard for agent types
export type AgentType = Agent['type'];

export const AGENT_TYPES: AgentType[] = [
  'ceo',
  'market-research',
  'product',
  'development',
  'marketing',
  'sales',
  'operations',
  'finance',
];

export function getAgentTypeDisplayName(type: AgentType): string {
  const names: Record<AgentType, string> = {
    ceo: 'CEO Agent',
    'market-research': 'Market Research Agent',
    product: 'Product Agent',
    development: 'Development Agent',
    marketing: 'Marketing Agent',
    sales: 'Sales Agent',
    operations: 'Operations Agent',
    finance: 'Finance Agent',
  };
  return names[type];
}
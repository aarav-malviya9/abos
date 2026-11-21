import axios, { AxiosInstance } from 'axios';
import { getConfig } from './config';
import { logAudit } from './db';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: LLMTool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' };
}

export class FreeLLMClient {
  public client: AxiosInstance;
  public mockMode: boolean;

  constructor() {
    const config = getConfig();
    this.mockMode = config.enableMockLlm;

    this.client = axios.create({
      baseURL: config.llmApiUrl,
      timeout: config.agentTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llmApiKey}`,
      },
    });

    // Response interceptor for logging
    this.client.interceptors.response.use(
      response => response,
      error => {
        logAudit({
          action: 'llm_api_error',
          entityType: 'llm',
          metadata: {
            url: error.config?.url,
            status: error.response?.status,
            message: error.message,
          },
        });
        return Promise.reject(error);
      }
    );
  }

  async complete(options: LLMCompletionOptions): Promise<LLMResponse> {
    if (this.mockMode) {
      return this.mockComplete(options);
    }

    const config = getConfig();
    const payload = {
      model: options.model || config.llmModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4000,
      tools: options.tools,
      tool_choice: options.toolChoice,
      response_format: options.responseFormat,
    };

    try {
      const response = await this.client.post('/chat/completions', payload);

      const choice = response.data.choices[0];
      const content = choice.message.content || '';
      const toolCalls = choice.message.tool_calls;

      logAudit({
        action: 'llm_completion',
        entityType: 'llm',
        metadata: {
          model: response.data.model,
          usage: response.data.usage,
          hasTools: !!toolCalls?.length,
        },
      });

      return {
        content,
        usage: response.data.usage
          ? {
              promptTokens: response.data.usage.prompt_tokens,
              completionTokens: response.data.usage.completion_tokens,
              totalTokens: response.data.usage.total_tokens,
            }
          : undefined,
        model: response.data.model,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`LLM API error: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async completeWithSchema<T>(
    options: LLMCompletionOptions & { schema: Record<string, unknown> }
  ): Promise<T> {
    const response = await this.complete({
      ...options,
      responseFormat: { type: 'json_object' },
    });

    try {
      return JSON.parse(response.content) as T;
    } catch {
      throw new Error('Failed to parse JSON response from LLM');
    }
  }

  async streamComplete(
    options: LLMCompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    if (this.mockMode) {
      const response = await this.mockComplete(options);
      onChunk(response.content);
      return response;
    }

    const config = getConfig();
    const payload = {
      model: options.model || config.llmModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4000,
      stream: true,
    };

    try {
      const response = await this.client.post('/chat/completions', payload, {
        responseType: 'stream',
      });

      let fullContent = '';
      let model = '';
      let usage: LLMResponse['usage'] = undefined;

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              model = parsed.model || model;
              if (parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens,
                  completionTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                };
              }
              const delta = parsed.choices[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                onChunk(delta);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      return { content: fullContent, usage, model };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`LLM streaming error: ${error.response?.status} - ${error.message}`);
      }
      throw error;
    }
  }

  private async mockComplete(options: LLMCompletionOptions): Promise<LLMResponse> {
    // Mock responses for development
    const lastMessage = options.messages[options.messages.length - 1];
    const prompt = lastMessage?.content || '';

    // Simple mock responses based on prompt content
    let mockContent = '';

    if (prompt.includes('business model') || prompt.includes('opportunity')) {
      mockContent = JSON.stringify({
        opportunities: [
          {
            name: 'AI-Powered SEO Content Generator',
            model: 'SaaS',
            description: 'Automated SEO content creation for small businesses',
            score: 78,
            estimatedMonthlyRevenue: 5000,
            startupCost: 200,
            competition: 'medium',
            demand: 'high',
          },
          {
            name: 'Niche Newsletter Aggregator',
            model: 'Content',
            description: 'Curated newsletter for specific professional niches',
            score: 72,
            estimatedMonthlyRevenue: 3000,
            startupCost: 50,
            competition: 'low',
            demand: 'medium',
          },
          {
            name: 'Digital Product Marketplace for Creators',
            model: 'Marketplace',
            description: 'Platform for selling digital templates, courses, assets',
            score: 65,
            estimatedMonthlyRevenue: 10000,
            startupCost: 500,
            competition: 'high',
            demand: 'high',
          },
        ],
      });
    } else if (prompt.includes('brand') || prompt.includes('name')) {
      mockContent = JSON.stringify({
        name: 'NexusFlow',
        tagline: 'Where Ideas Connect',
        colors: { primary: '#3B82F6', secondary: '#1E293B', accent: '#F59E0B' },
        logoConcept: 'Interconnected nodes forming a flow',
        domainSuggestions: ['nexusflow.io', 'nexusflow.app', 'getnexusflow.com'],
      });
    } else if (prompt.includes('marketing') || prompt.includes('content')) {
      mockContent = JSON.stringify({
        strategy: 'Content-led growth with SEO focus',
        channels: ['blog', 'twitter', 'linkedin', 'newsletter'],
        contentCalendar: [
          { week: 1, topic: 'Getting started guide', type: 'blog' },
          { week: 2, topic: 'Case study', type: 'blog' },
          { week: 3, topic: 'Industry insights', type: 'newsletter' },
          { week: 4, topic: 'Feature highlight', type: 'social' },
        ],
      });
    } else if (prompt.includes('financial') || prompt.includes('revenue')) {
      mockContent = JSON.stringify({
        projections: {
          month1: { revenue: 0, expenses: 150, profit: -150 },
          month2: { revenue: 500, expenses: 200, profit: 300 },
          month3: { revenue: 1500, expenses: 300, profit: 1200 },
          month6: { revenue: 5000, expenses: 500, profit: 4500 },
          month12: { revenue: 15000, expenses: 1000, profit: 14000 },
        },
        assumptions: ['10% month-over-month growth', '5% churn', '$50 ARPU'],
      });
    } else {
      mockContent = JSON.stringify({ result: 'Mock response for development', prompt: prompt.slice(0, 100) });
    }

    return {
      content: mockContent,
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      model: 'mock-model',
    };
  }

  async healthCheck(): Promise<boolean> {
    if (this.mockMode) return true;

    try {
      await this.client.get('/models');
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let clientInstance: FreeLLMClient | null = null;

export function getLLMClient(): FreeLLMClient {
  if (!clientInstance) {
    clientInstance = new FreeLLMClient();
  }
  return clientInstance;
}

export function resetLLMClient(): void {
  clientInstance = null;
}
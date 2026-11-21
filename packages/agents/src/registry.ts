import { Agent, getEntity, listEntities, updateEntity } from '@abos/core';
import { BaseAgent } from './base';
import { CEOAgent } from './ceo';
import { MarketResearchAgent } from './market-research';
import { ProductAgent } from './product';
import { DevelopmentAgent } from './development';
import { MarketingAgent } from './marketing';
import { SalesAgent } from './sales';
import { OperationsAgent } from './operations';
import { FinanceAgent } from './finance';
import { agentLogger } from '@abos/core';

export type AgentType = Agent['type'];

export interface AgentInstance {
  agent: Agent;
  instance: BaseAgent;
}

class AgentRegistry {
  private instances: Map<string, AgentInstance> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const agents = await listEntities<Agent>('agent');
    for (const agent of agents) {
      await this.createInstance(agent);
    }

    this.initialized = true;
    agentLogger.info({ count: this.instances.size }, 'Agent registry initialized');
  }

  private async createInstance(agent: Agent): Promise<BaseAgent | null> {
    let instance: BaseAgent | null = null;

    switch (agent.type) {
      case 'ceo':
        instance = new CEOAgent(agent);
        break;
      case 'market-research':
        instance = new MarketResearchAgent(agent);
        break;
      case 'product':
        instance = new ProductAgent(agent);
        break;
      case 'development':
        instance = new DevelopmentAgent(agent);
        break;
      case 'marketing':
        instance = new MarketingAgent(agent);
        break;
      case 'sales':
        instance = new SalesAgent(agent);
        break;
      case 'operations':
        instance = new OperationsAgent(agent);
        break;
      case 'finance':
        instance = new FinanceAgent(agent);
        break;
      default:
        agentLogger.warn({ type: agent.type }, 'Unknown agent type');
        return null;
    }

    if (instance) {
      this.instances.set(agent.id, { agent, instance });
      agentLogger.info({ agentId: agent.id, type: agent.type }, 'Agent instance created');
    }

    return instance;
  }

  async getAgent(agentId: string): Promise<AgentInstance | undefined> {
    return this.instances.get(agentId);
  }

  async getAgentByType(type: AgentType): Promise<AgentInstance | undefined> {
    for (const [, instance] of this.instances) {
      if (instance.agent.type === type) {
        return instance;
      }
    }
    return undefined;
  }

  async getAllAgents(): Promise<AgentInstance[]> {
    return Array.from(this.instances.values());
  }

  async getIdleAgents(): Promise<AgentInstance[]> {
    const agents: AgentInstance[] = [];
    for (const instance of this.instances.values()) {
      if (instance.agent.status === 'idle') {
        agents.push(instance);
      }
    }
    return agents;
  }

  async refreshAgent(agentId: string): Promise<void> {
    const agent = await getEntity<Agent>('agent', agentId);
    if (agent) {
      this.instances.delete(agentId);
      await this.createInstance(agent);
    }
  }

  async executeTask(agentId: string, task: any): Promise<any> {
    const instance = this.instances.get(agentId);
    if (!instance) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return instance.instance.execute({
      agent: instance.agent,
      task,
      config: instance.agent.config || {},
    });
  }

  async executeByType(type: AgentType, task: any): Promise<any> {
    const instance = await this.getAgentByType(type);
    if (!instance) {
      throw new Error(`No agent of type: ${type}`);
    }

    return instance.instance.execute({
      agent: instance.agent,
      task,
      config: instance.agent.config || {},
    });
  }
}

export const agentRegistry = new AgentRegistry();
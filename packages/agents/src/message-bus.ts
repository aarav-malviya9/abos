import { createEntity, listEntities, updateEntity } from '@abos/core';
import { agentLogger } from '@abos/core';

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string | 'broadcast';
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  processed: boolean;
  processedAt?: string;
}

export interface MessageHandler {
  (message: AgentMessage): Promise<void>;
}

class MessageBus {
  private handlers: Map<string, MessageHandler[]> = new Map();
  private processing = false;

  async send(message: Omit<AgentMessage, 'id' | 'timestamp' | 'processed' | 'processedAt'>): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      processed: false,
    };

    // Store message
    await createEntity('task', {
      projectId: undefined,
      agentId: message.toAgentId !== 'broadcast' ? message.toAgentId : undefined,
      type: 'message',
      title: `Message: ${message.type}`,
      payload: fullMessage as any,
      status: 'pending',
    });

    agentLogger.debug({ from: message.fromAgentId, to: message.toAgentId, type: message.type }, 'Message sent');
  }

  async broadcast(fromAgentId: string, type: string, payload: Record<string, unknown>): Promise<void> {
    await this.send({ fromAgentId, toAgentId: 'broadcast', type, payload });
  }

  async sendToAgent(fromAgentId: string, toAgentId: string, type: string, payload: Record<string, unknown>): Promise<void> {
    await this.send({ fromAgentId, toAgentId, type, payload });
  }

  registerHandler(messageType: string, handler: MessageHandler): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, []);
    }
    this.handlers.get(messageType)!.push(handler);
  }

  async processMessages(): Promise<number> {
    if (this.processing) return 0;
    this.processing = true;

    try {
      const messages = await listEntities('task', {
        where: { type: 'message', status: 'pending' },
      });

      let processed = 0;
      for (const messageTask of messages) {
        const message = messageTask.payload as AgentMessage;

        // Check if message is for this agent or broadcast
        const handlers = this.handlers.get(message.type) || [];
        let handled = false;

        for (const handler of handlers) {
          try {
            await handler(message);
            handled = true;
          } catch (error) {
            agentLogger.error({ error, messageType: message.type }, 'Message handler failed');
          }
        }

        if (handled || message.toAgentId === 'broadcast') {
          await updateEntity('task', messageTask.id as string, {
            status: 'completed',
            completedAt: new Date().toISOString(),
          });
          processed++;
        }
      }

      return processed;
    } finally {
      this.processing = false;
    }
  }

  async getPendingMessages(agentId: string): Promise<AgentMessage[]> {
    const messages = await listEntities('task', {
      where: { type: 'message', status: 'pending' },
    });

    return messages
      .filter(m => {
        const msg = m.payload as AgentMessage;
        return msg.toAgentId === agentId || msg.toAgentId === 'broadcast';
      })
      .map(m => m.payload as AgentMessage);
  }
}

export const messageBus = new MessageBus();

// Standard message types
export const MESSAGE_TYPES = {
  TASK_DELEGATED: 'task.delegated',
  TASK_COMPLETED: 'task.completed',
  REPORT_GENERATED: 'report.generated',
  OPPORTUNITY_FOUND: 'opportunity.found',
  PROJECT_UPDATED: 'project.updated',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_GRANTED: 'approval.granted',
  APPROVAL_DENIED: 'approval.denied',
  ALERT: 'alert',
  SYSTEM_SHUTDOWN: 'system.shutdown',
} as const;
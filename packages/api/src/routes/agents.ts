import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { listEntities, getEntity, updateEntity, createEntity } from '@abos/core';
import { agentRegistry } from '@abos/agents';
import { broadcast } from '../server';

const router = Router();

// Get all agents
router.get('/', async (req: Request, res: Response) => {
  try {
    const agents = await listEntities('agent');
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get agent by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const agent = await getEntity('agent', req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// Execute agent task
const executeSchema = z.object({
  agentType: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()).optional(),
});

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { agentType, action, payload } = executeSchema.parse(req.body);

    const instance = await agentRegistry.getAgentByType(agentType as any);
    if (!instance) {
      return res.status(404).json({ error: `Agent type not found: ${agentType}` });
    }

    // Create task record
    const task = await createEntity<{
      id: string;
      projectId?: string;
      agentId?: string;
      type: string;
      title: string;
      description?: string;
      status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
      priority: number;
      payload: Record<string, unknown>;
      result: Record<string, unknown>;
      error?: string;
      startedAt?: string;
      completedAt?: string;
      retries: number;
      maxRetries: number;
      createdAt: string;
      updatedAt?: string;
    }>('task', {
      agentId: instance.agent.id,
      type: action,
      title: `Execute ${action}`,
      payload: payload || {},
      status: 'running',
      startedAt: new Date().toISOString(),
      priority: 0,
      result: {},
      retries: 0,
      maxRetries: 3,
    });

    // Execute asynchronously
    instance.instance.execute({
      agent: instance.agent,
      task,
      config: instance.agent.config || {},
    }).then(async (result) => {
      await updateEntity('task', task.id, {
        status: result.success ? 'completed' : 'failed',
        completedAt: new Date().toISOString(),
        result: result.output || {},
        error: result.error,
      });

      broadcast({ type: 'task_completed', taskId: task.id, result });
    }).catch(async (error) => {
      await updateEntity('task', task.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: error.message,
      });

      broadcast({ type: 'task_failed', taskId: task.id, error: error.message });
    });

    res.json({ taskId: task.id, status: 'started' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to execute agent task' });
  }
});

// Get agent tasks
router.get('/:id/tasks', async (req: Request, res: Response) => {
  try {
    const tasks = await listEntities('task', { where: { agentId: req.params.id } });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

export default router;
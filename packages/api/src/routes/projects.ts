import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { listEntities, getEntity, createEntity, updateEntity } from '@abos/core';

const router = Router();

const createProjectSchema = z.object({
  opportunityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  brandData: z.record(z.unknown()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  brandData: z.record(z.unknown()).optional(),
  status: z.enum(['planning', 'building', 'launching', 'active', 'paused', 'closed']).optional(),
  websiteUrl: z.string().url().optional(),
  repositoryUrl: z.string().url().optional(),
});

// Get all projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const projects = await listEntities('businessProject', status ? { where: { status } } : undefined);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get project by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await getEntity('businessProject', req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await createEntity('businessProject', data);
    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const data = updateProjectSchema.parse(req.body);
    const project = await updateEntity('businessProject', req.params.id, data);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Get project tasks
router.get('/:id/tasks', async (req: Request, res: Response) => {
  try {
    const tasks = await listEntities('task', { where: { projectId: req.params.id } });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

export default router;
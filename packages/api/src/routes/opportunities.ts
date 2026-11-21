import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { listEntities, getEntity, createEntity, updateEntity } from '@abos/core';

const router = Router();

const createOpportunitySchema = z.object({
  name: z.string().min(1).max(200),
  model: z.string().min(1).max(100),
  description: z.string().optional(),
  score: z.number().min(0).max(100).default(0),
  researchData: z.record(z.unknown()).default({}),
});

const updateOpportunitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  model: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  status: z.enum(['researching', 'validating', 'selected', 'rejected', 'archived']).optional(),
  researchData: z.record(z.unknown()).optional(),
  validationData: z.record(z.unknown()).optional(),
});

// Get all opportunities
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const opportunities = await listEntities('businessOpportunity', status ? { where: { status } } : undefined);
    res.json(opportunities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

// Get opportunity by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const opportunity = await getEntity('businessOpportunity', req.params.id);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    res.json(opportunity);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
});

// Create opportunity
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createOpportunitySchema.parse(req.body);
    const opportunity = await createEntity('businessOpportunity', data);
    res.status(201).json(opportunity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create opportunity' });
  }
});

// Update opportunity
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const data = updateOpportunitySchema.parse(req.body);
    const opportunity = await updateEntity('businessOpportunity', req.params.id, data);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    res.json(opportunity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to update opportunity' });
  }
});

export default router;
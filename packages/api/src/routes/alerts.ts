import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createEntity, listEntities } from '@abos/core';

const router = Router();

const createAlertSchema = z.object({
  type: z.string(),
  message: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createAlertSchema.parse(req.body);
    const alert = await createEntity('auditLog', {
      action: 'alert',
      entityType: 'alert',
      metadata: data,
    });
    res.status(201).json(alert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const alerts = await listEntities('auditLog', { where: { entityType: 'alert' } });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

export default router;
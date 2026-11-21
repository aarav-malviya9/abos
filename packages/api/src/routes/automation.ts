import { Router, Request, Response } from 'express';
import { listEntities } from '@abos/core';

const router = Router();

router.get('/runs', async (req: Request, res: Response) => {
  try {
    const workflowName = req.query.workflowName as string | undefined;
    const status = req.query.status as string | undefined;
    const where: Record<string, unknown> = {};
    if (workflowName) where.workflowName = workflowName;
    if (status) where.status = status;
    const runs = await listEntities('automationRun', Object.keys(where).length > 0 ? { where } : undefined);
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch automation runs' });
  }
});

router.get('/runs/:id', async (req: Request, res: Response) => {
  try {
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

export default router;
import { Router, Request, Response } from 'express';
import { listEntities } from '@abos/core';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const type = req.query.type as string | undefined;
    const where: Record<string, unknown> = {};
    if (agentId) where.agentId = agentId;
    if (type) where.type = type;
    const reports = await listEntities('agentReport', Object.keys(where).length > 0 ? { where } : undefined);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

export default router;
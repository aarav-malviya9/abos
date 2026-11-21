import { Router, Request, Response } from 'express';
import { listEntities } from '@abos/core';

const router = Router();

router.get('/content', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const status = req.query.status as string | undefined;
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    const content = await listEntities('marketingContent', Object.keys(where).length > 0 ? { where } : undefined);
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch marketing content' });
  }
});

router.get('/content/:id', async (req: Request, res: Response) => {
  try {
    // Would need getEntity for marketingContent
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

export default router;
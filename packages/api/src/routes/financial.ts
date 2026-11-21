import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { listEntities, createEntity } from '@abos/core';

const router = Router();

const createTransactionSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['revenue', 'expense']),
  amount: z.number(),
  currency: z.string().length(3).default('USD'),
  category: z.string().max(100),
  description: z.string().optional(),
  date: z.string().datetime(),
  reference: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const type = req.query.type as string | undefined;
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (type) where.type = type;
    const transactions = await listEntities('financialTransaction', Object.keys(where).length > 0 ? { where } : undefined);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.post('/transactions', async (req: Request, res: Response) => {
  try {
    const data = createTransactionSchema.parse(req.body);
    const transaction = await createEntity('financialTransaction', data);
    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Summary endpoint
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const period = req.query.period as string || 'monthly';

    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' });
    }

    const transactions = await listEntities<{
  id: string;
  projectId: string;
  type: 'revenue' | 'expense';
  amount: number;
  currency: string;
  category: string;
  description: string | undefined;
  date: string;
  reference: string | undefined;
  tags: string[];
}>( 'financialTransaction', { where: { projectId } });
    const now = new Date();
    let cutoffDate: Date;

    switch (period) {
      case 'daily':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
      default:
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const periodTransactions = transactions.filter(t => new Date(t.date) >= cutoffDate);
    const revenue = periodTransactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
    const expenses = periodTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const profit = revenue - expenses;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const revenueBreakdown: Record<string, number> = {};
    const expenseBreakdown: Record<string, number> = {};

    for (const t of periodTransactions) {
      if (t.type === 'revenue') {
        revenueBreakdown[t.category] = (revenueBreakdown[t.category] || 0) + t.amount;
      } else {
        expenseBreakdown[t.category] = (expenseBreakdown[t.category] || 0) + t.amount;
      }
    }

    res.json({
      period,
      revenue,
      expenses,
      profit,
      margin,
      revenueBreakdown,
      expenseBreakdown,
      transactionCount: periodTransactions.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;
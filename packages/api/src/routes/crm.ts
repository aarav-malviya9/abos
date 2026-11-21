import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { listEntities, getEntity, createEntity, updateEntity } from '@abos/core';

const router = Router();

const createContactSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
  status: z.enum(['lead', 'qualified', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost']).default('lead'),
  source: z.string().max(100).optional(),
  notes: z.string().optional(),
});

const updateContactSchema = createContactSchema.partial();

const createDealSchema = z.object({
  projectId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  stage: z.enum(['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost']).default('prospecting'),
  value: z.number().default(0),
  probability: z.number().min(0).max(100).default(0),
  expectedCloseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateDealSchema = createDealSchema.partial();

// Contacts
router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const status = req.query.status as string | undefined;
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    const contacts = await listEntities('crmContact', Object.keys(where).length > 0 ? { where } : undefined);
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.get('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const contact = await getEntity('crmContact', req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

router.post('/contacts', async (req: Request, res: Response) => {
  try {
    const data = createContactSchema.parse(req.body);
    const contact = await createEntity('crmContact', data);
    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

router.patch('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const data = updateContactSchema.parse(req.body);
    const contact = await updateEntity('crmContact', req.params.id, data);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Deals
router.get('/deals', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const stage = req.query.stage as string | undefined;
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (stage) where.stage = stage;
    const deals = await listEntities('crmDeal', Object.keys(where).length > 0 ? { where } : undefined);
    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

router.get('/deals/:id', async (req: Request, res: Response) => {
  try {
    const deal = await getEntity('crmDeal', req.params.id);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

router.post('/deals', async (req: Request, res: Response) => {
  try {
    const data = createDealSchema.parse(req.body);
    const deal = await createEntity('crmDeal', data);
    res.status(201).json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

router.patch('/deals/:id', async (req: Request, res: Response) => {
  try {
    const data = updateDealSchema.parse(req.body);
    const deal = await updateEntity('crmDeal', req.params.id, data);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

export default router;
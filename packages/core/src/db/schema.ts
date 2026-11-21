import { z } from 'zod';

// Base entity with common fields
const baseEntity = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

// Business Opportunity
export const businessOpportunitySchema = baseEntity.extend({
  name: z.string().min(1).max(200),
  model: z.string().min(1).max(100),
  description: z.string().optional(),
  score: z.number().min(0).max(100),
  status: z.enum(['researching', 'validating', 'selected', 'rejected', 'archived']),
  researchData: z.record(z.unknown()).default({}),
  validationData: z.record(z.unknown()).default({}),
  selectedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().optional(),
});

export type BusinessOpportunity = z.infer<typeof businessOpportunitySchema>;

// Business Project
export const businessProjectSchema = baseEntity.extend({
  opportunityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  brandData: z.record(z.unknown()).default({}),
  status: z.enum(['planning', 'building', 'launching', 'active', 'paused', 'closed']),
  websiteUrl: z.string().url().optional(),
  repositoryUrl: z.string().url().optional(),
  launchedAt: z.string().datetime().optional(),
});

export type BusinessProject = z.infer<typeof businessProjectSchema>;

// Agent
export const agentSchema = baseEntity.extend({
  name: z.string().min(1).max(100),
  type: z.enum(['ceo', 'market-research', 'product', 'development', 'marketing', 'sales', 'operations', 'finance']),
  status: z.enum(['idle', 'running', 'completed', 'error', 'disabled']),
  config: z.record(z.unknown()).default({}),
  lastRunAt: z.string().datetime().optional(),
  nextRunAt: z.string().datetime().optional(),
  lastError: z.string().optional(),
  runCount: z.number().int().default(0),
});

export type Agent = z.infer<typeof agentSchema>;

// Task
export const taskSchema = baseEntity.extend({
  projectId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(['pending', 'queued', 'running', 'completed', 'failed', 'cancelled']),
  priority: z.number().int().default(0),
  payload: z.record(z.unknown()).default({}),
  result: z.record(z.unknown()).default({}),
  error: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  retries: z.number().int().default(0),
  maxRetries: z.number().int().default(3),
});

export type Task = z.infer<typeof taskSchema>;

// CRM Contact
export const crmContactSchema = baseEntity.extend({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
  status: z.enum(['lead', 'qualified', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost']),
  source: z.string().max(100).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  lastContactAt: z.string().datetime().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
});

export type CrmContact = z.infer<typeof crmContactSchema>;

// CRM Deal
export const crmDealSchema = baseEntity.extend({
  projectId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  stage: z.enum(['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost']),
  value: z.number().default(0),
  probability: z.number().min(0).max(100).default(0),
  expectedCloseDate: z.string().datetime().optional(),
  actualCloseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export type CrmDeal = z.infer<typeof crmDealSchema>;

// Financial Transaction
export const financialTransactionSchema = baseEntity.extend({
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

export type FinancialTransaction = z.infer<typeof financialTransactionSchema>;

// Marketing Content
export const marketingContentSchema = baseEntity.extend({
  projectId: z.string().uuid(),
  type: z.enum(['blog', 'social', 'email', 'video', 'ad', 'landing-page', 'whitepaper', 'case-study']),
  title: z.string().min(1).max(500),
  content: z.string(),
  status: z.enum(['draft', 'review', 'approved', 'published', 'archived']),
  platform: z.string().max(100).optional(),
  url: z.string().url().optional(),
  metrics: z.record(z.unknown()).default({}),
  scheduledAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
});

export type MarketingContent = z.infer<typeof marketingContentSchema>;

// Automation Run
export const automationRunSchema = baseEntity.extend({
  workflowName: z.string().min(1).max(200),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  triggeredBy: z.enum(['schedule', 'webhook', 'manual', 'agent']),
  triggerData: z.record(z.unknown()).default({}),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  logs: z.array(z.string()).default([]),
  error: z.string().optional(),
  durationMs: z.number().int().optional(),
});

export type AutomationRun = z.infer<typeof automationRunSchema>;

// Audit Log
export const auditLogSchema = baseEntity.extend({
  action: z.string().min(1).max(100),
  entityType: z.string().min(1).max(100),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  agentId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type AuditLog = z.infer<typeof auditLogSchema>;

// Agent Report
export const agentReportSchema = baseEntity.extend({
  agentId: z.string().uuid(),
  type: z.enum(['daily', 'weekly', 'monthly', 'ad-hoc', 'alert']),
  title: z.string().min(1).max(500),
  content: z.string(),
  metrics: z.record(z.unknown()).default({}),
  recommendations: z.array(z.string()).default([]),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

export type AgentReport = z.infer<typeof agentReportSchema>;

// All schemas for validation
export const schemas = {
  businessOpportunity: businessOpportunitySchema,
  businessProject: businessProjectSchema,
  agent: agentSchema,
  task: taskSchema,
  crmContact: crmContactSchema,
  crmDeal: crmDealSchema,
  financialTransaction: financialTransactionSchema,
  marketingContent: marketingContentSchema,
  automationRun: automationRunSchema,
  auditLog: auditLogSchema,
  agentReport: agentReportSchema,
} as const;

export type EntityType = keyof typeof schemas;
export type EntitySchema = (typeof schemas)[EntityType];
import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { getConfig } from '../config';
import { schemas, EntityType } from './schema';

let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const config = getConfig();
  const dbPath = resolve(config.databasePath);

  // Ensure directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Enable WAL mode and foreign keys
  await dbInstance.exec('PRAGMA journal_mode = WAL;');
  await dbInstance.exec('PRAGMA foreign_keys = ON;');
  await dbInstance.exec('PRAGMA synchronous = NORMAL;');

  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

// Initialize database tables
export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  // Create tables
  const createTableStatements = [
    `CREATE TABLE IF NOT EXISTS business_opportunities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      description TEXT,
      score REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'researching',
      research_data TEXT NOT NULL DEFAULT '{}',
      validation_data TEXT NOT NULL DEFAULT '{}',
      selected_at TEXT,
      rejected_at TEXT,
      rejection_reason TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS business_projects (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL,
      name TEXT NOT NULL,
      brand_data TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'planning',
      website_url TEXT,
      repository_url TEXT,
      launched_at TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (opportunity_id) REFERENCES business_opportunities(id)
    )`,
    `CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      config TEXT NOT NULL DEFAULT '{}',
      last_run_at TEXT,
      next_run_at TEXT,
      last_error TEXT,
      run_count INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      agent_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL DEFAULT '{}',
      result TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      started_at TEXT,
      completed_at TEXT,
      retries INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (project_id) REFERENCES business_projects(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    )`,
    `CREATE TABLE IF NOT EXISTS crm_contacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      role TEXT,
      status TEXT NOT NULL DEFAULT 'lead',
      source TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      last_contact_at TEXT,
      next_follow_up_at TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (project_id) REFERENCES business_projects(id)
    )`,
    `CREATE TABLE IF NOT EXISTS crm_deals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      contact_id TEXT,
      title TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'prospecting',
      value REAL NOT NULL DEFAULT 0,
      probability REAL NOT NULL DEFAULT 0,
      expected_close_date TEXT,
      actual_close_date TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (project_id) REFERENCES business_projects(id),
      FOREIGN KEY (contact_id) REFERENCES crm_contacts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS financial_transactions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      category TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      reference TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (project_id) REFERENCES business_projects(id)
    )`,
    `CREATE TABLE IF NOT EXISTS marketing_content (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      platform TEXT,
      url TEXT,
      metrics TEXT NOT NULL DEFAULT '{}',
      scheduled_at TEXT,
      published_at TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (project_id) REFERENCES business_projects(id)
    )`,
    `CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      workflow_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      triggered_by TEXT NOT NULL,
      trigger_data TEXT NOT NULL DEFAULT '{}',
      started_at TEXT,
      completed_at TEXT,
      logs TEXT NOT NULL DEFAULT '[]',
      error TEXT,
      duration_ms INTEGER,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      user_id TEXT,
      agent_id TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      createdAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS agent_reports (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      metrics TEXT NOT NULL DEFAULT '{}',
      recommendations TEXT NOT NULL DEFAULT '[]',
      priority TEXT NOT NULL DEFAULT 'medium',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    )`,
  ];

  await db.exec('BEGIN TRANSACTION;');
  try {
    for (const stmt of createTableStatements) {
      await db.exec(stmt);
    }
    await db.exec('COMMIT;');
  } catch (error) {
    await db.exec('ROLLBACK;');
    throw error;
  }

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_opportunities_status ON business_opportunities(status)',
    'CREATE INDEX IF NOT EXISTS idx_projects_opportunity ON business_projects(opportunity_id)',
    'CREATE INDEX IF NOT EXISTS idx_projects_status ON business_projects(status)',
    'CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_project ON crm_contacts(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_status ON crm_contacts(status)',
    'CREATE INDEX IF NOT EXISTS idx_deals_project ON crm_deals(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_deals_stage ON crm_deals(stage)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_project ON financial_transactions(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_date ON financial_transactions(date)',
    'CREATE INDEX IF NOT EXISTS idx_content_project ON marketing_content(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_content_status ON marketing_content(status)',
    'CREATE INDEX IF NOT EXISTS idx_automation_workflow ON automation_runs(workflow_name)',
    'CREATE INDEX IF NOT EXISTS idx_automation_status ON automation_runs(status)',
    'CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_reports_agent ON agent_reports(agent_id)',
  ];

  for (const index of indexes) {
    await db.exec(index);
  }
}

// CamelCase to snake_case column mapping for SQL tables
const COLUMN_MAP: Record<EntityType, Record<string, string>> = {
  businessOpportunity: {
    researchData: 'research_data',
    validationData: 'validation_data',
    selectedAt: 'selected_at',
    rejectedAt: 'rejected_at',
    rejectionReason: 'rejection_reason',
  },
  businessProject: {
    opportunityId: 'opportunity_id',
    brandData: 'brand_data',
    websiteUrl: 'website_url',
    repositoryUrl: 'repository_url',
    launchedAt: 'launched_at',
  },
  agent: {
    lastRunAt: 'last_run_at',
    nextRunAt: 'next_run_at',
    lastError: 'last_error',
    runCount: 'run_count',
  },
  task: {
    projectId: 'project_id',
    agentId: 'agent_id',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    maxRetries: 'max_retries',
  },
  crmContact: {
    projectId: 'project_id',
    lastContactAt: 'last_contact_at',
    nextFollowUpAt: 'next_follow_up_at',
  },
  crmDeal: {
    projectId: 'project_id',
    contactId: 'contact_id',
    expectedCloseDate: 'expected_close_date',
    actualCloseDate: 'actual_close_date',
  },
  financialTransaction: {
    projectId: 'project_id',
  },
  marketingContent: {
    projectId: 'project_id',
    scheduledAt: 'scheduled_at',
    publishedAt: 'published_at',
  },
  automationRun: {
    workflowName: 'workflow_name',
    triggeredBy: 'triggered_by',
    triggerData: 'trigger_data',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    durationMs: 'duration_ms',
  },
  auditLog: {
    entityType: 'entity_type',
    entityId: 'entity_id',
    userId: 'user_id',
    agentId: 'agent_id',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
  },
  agentReport: {
    agentId: 'agent_id',
  },
};

function toSnakeCase(key: string): string {
  if (key === 'createdAt') return key;
  if (key === 'updatedAt') return 'updated_at';
  return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Generic repository functions
const now = () => new Date().toISOString();

function generateId(): string {
  return crypto.randomUUID();
}

export async function createEntity<T extends Record<string, unknown>>(type: EntityType, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
  const db = await getDatabase();
  const schema = schemas[type];
  const id = generateId();
  const timestamp = now();

  const entity = {
    ...data,
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as unknown as T;

  // Validate
  const result = schema.safeParse(entity);
  if (!result.success) {
    throw new Error(`Validation failed for ${type}: ${result.error.message}`);
  }

  // Build insert statement with camelCase → snake_case column mapping
  const colMap = COLUMN_MAP[type] || {};
  const columns = Object.keys(entity)
    .filter(k => k !== 'updatedAt')
    .map(k => colMap[k] || toSnakeCase(k))
    .join(', ');
  const placeholders = Object.keys(entity)
    .filter(k => k !== 'updatedAt')
    .map(() => '?')
    .join(', ');
  const values = Object.entries(entity)
    .filter(([k]) => k !== 'updatedAt')
    .map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : v));

  try {
    await db.run(`INSERT INTO ${getTableName(type)} (${columns}) VALUES (${placeholders})`, ...values);
  } catch (error) {
    console.error('Insert failed:', { type, columns, values, error });
    throw error;
  }

  return entity;
}

export async function getEntity<T extends Record<string, unknown>>(type: EntityType, id: string): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.get(`SELECT * FROM ${getTableName(type)} WHERE id = ?`, id);
  if (!row) return null;
  return deserializeRow(type, row) as T;
}

export async function updateEntity<T extends Record<string, unknown>>(type: EntityType, id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T | null> {
  const db = await getDatabase();
  const existing = await getEntity(type, id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...data,
    updatedAt: now(),
  } as unknown as T;

  const schema = schemas[type];
  const result = schema.safeParse(updated);
  if (!result.success) {
    throw new Error(`Validation failed for ${type}: ${result.error.message}`);
  }

  const colMap = COLUMN_MAP[type] || {};
  const columnNames = Object.keys(data)
    .filter(k => k !== 'id' && k !== 'createdAt')
    .map(k => colMap[k] || toSnakeCase(k));
  const columns = columnNames.map(k => `${k} = ?`).join(', ');
  const values = Object.entries(data)
    .filter(([k]) => k !== 'id' && k !== 'createdAt')
    .map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : v));
  values.push(id);

  await db.run(`UPDATE ${getTableName(type)} SET ${columns}, updated_at = ? WHERE id = ?`, ...values);

  return updated;
}

export async function deleteEntity(type: EntityType, id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.run(`DELETE FROM ${getTableName(type)} WHERE id = ?`, id);
  return (result.changes ?? 0) > 0;
}

export async function listEntities<T extends Record<string, unknown>>(type: EntityType, options?: {
  where?: Record<string, unknown>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}): Promise<T[]> {
  const db = await getDatabase();
  let query = `SELECT * FROM ${getTableName(type)}`;
  const params: unknown[] = [];

  if (options?.where) {
    const colMap = COLUMN_MAP[type] || {};
    const conditions = Object.keys(options.where).map(k => `${colMap[k] || toSnakeCase(k)} = ?`).join(' AND ');
    query += ` WHERE ${conditions}`;
    params.push(...Object.values(options.where));
  }

  if (options?.orderBy) {
    query += ` ORDER BY ${options.orderBy}`;
  } else {
    query += ` ORDER BY createdAt DESC`;
  }

  if (options?.limit) {
    query += ` LIMIT ?`;
    params.push(options.limit);
  }

  if (options?.offset) {
    query += ` OFFSET ?`;
    params.push(options.offset);
  }

  const rows = await db.all(query, ...params) as Record<string, unknown>[];
  return rows.map(row => deserializeRow(type, row) as T);
}

export async function countEntities(type: EntityType, where?: Record<string, unknown>): Promise<number> {
  const db = await getDatabase();
  let query = `SELECT COUNT(*) as count FROM ${getTableName(type)}`;
  const params: unknown[] = [];

  if (where) {
    const conditions = Object.keys(where).map(k => `${k} = ?`).join(' AND ');
    query += ` WHERE ${conditions}`;
    params.push(...Object.values(where));
  }

  const row = await db.get(query, ...params) as { count: number };
  return row.count;
}

function getTableName(type: EntityType): string {
  const tableNames: Record<EntityType, string> = {
    businessOpportunity: 'business_opportunities',
    businessProject: 'business_projects',
    agent: 'agents',
    task: 'tasks',
    crmContact: 'crm_contacts',
    crmDeal: 'crm_deals',
    financialTransaction: 'financial_transactions',
    marketingContent: 'marketing_content',
    automationRun: 'automation_runs',
    auditLog: 'audit_log',
    agentReport: 'agent_reports',
  };
  return tableNames[type];
}

function deserializeRow(type: EntityType, row: Record<string, unknown>): Record<string, unknown> {
  const colMap = COLUMN_MAP[type] || {};
  const snakeToCamel: Record<string, string> = Object.fromEntries(
    Object.entries(colMap).map(([camel, snake]) => [snake, camel])
  );
  snakeToCamel['updated_at'] = 'updatedAt';

  const entity: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = snakeToCamel[key] || key;
    entity[camelKey] = value;
  }

  // Parse JSON fields
  const jsonFields: Record<EntityType, string[]> = {
    businessOpportunity: ['researchData', 'validationData'],
    businessProject: ['brandData'],
    agent: ['config'],
    task: ['payload', 'result'],
    crmContact: ['tags'],
    crmDeal: [],
    financialTransaction: ['tags'],
    marketingContent: ['metrics'],
    automationRun: ['triggerData', 'logs'],
    auditLog: ['metadata'],
    agentReport: ['metrics', 'recommendations'],
  };

  for (const field of jsonFields[type] || []) {
    if (entity[field] && typeof entity[field] === 'string') {
      try {
        entity[field] = JSON.parse(entity[field] as string);
      } catch {
        entity[field] = field.endsWith('s') ? [] : {};
      }
    }
  }

  return entity;
}

// Audit log helper
export async function logAudit(entry: {
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await createEntity('auditLog', {
    ...entry,
    metadata: entry.metadata || {},
  });
}
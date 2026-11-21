#!/usr/bin/env tsx
import { initializeDatabase, getDatabase, createEntity } from '../packages/core/src/db';
import { getConfig } from '../packages/core/src/config';
import { logger } from '../packages/core/src/logger';
import { v4 as uuidv4 } from 'crypto';

async function main() {
  try {
    logger.info('Initializing ABOS database...');
    const config = getConfig();

    logger.info({ dbPath: config.databasePath }, 'Database configuration');

    // Initialize tables
    initializeDatabase();
    logger.info('Database tables created successfully');

    // Initialize default agents
    const defaultAgents = [
      {
        name: 'CEO Agent',
        type: 'ceo',
        status: 'idle',
        config: { schedule: '0 9 * * *', maxConcurrentTasks: 3 },
      },
      {
        name: 'Market Research Agent',
        type: 'market-research',
        status: 'idle',
        config: { schedule: '0 */6 * * *', maxConcurrentTasks: 2 },
      },
      {
        name: 'Product Agent',
        type: 'product',
        status: 'idle',
        config: { schedule: '0 10 * * *', maxConcurrentTasks: 2 },
      },
      {
        name: 'Development Agent',
        type: 'development',
        status: 'idle',
        config: { schedule: '0 11 * * *', maxConcurrentTasks: 1 },
      },
      {
        name: 'Marketing Agent',
        type: 'marketing',
        status: 'idle',
        config: { schedule: '0 12 * * *', maxConcurrentTasks: 3 },
      },
      {
        name: 'Sales Agent',
        type: 'sales',
        status: 'idle',
        config: { schedule: '0 14 * * *', maxConcurrentTasks: 2 },
      },
      {
        name: 'Operations Agent',
        type: 'operations',
        status: 'idle',
        config: { schedule: '0 15 * * *', maxConcurrentTasks: 3 },
      },
      {
        name: 'Finance Agent',
        type: 'finance',
        status: 'idle',
        config: { schedule: '0 16 * * *', maxConcurrentTasks: 1 },
      },
    ];

    const db = getDatabase();
    const existingAgents = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };

    if (existingAgents.count === 0) {
      logger.info('Creating default agents...');
      for (const agent of defaultAgents) {
        createEntity('agent', {
          id: uuidv4(),
          ...agent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      logger.info('Default agents created');
    } else {
      logger.info({ count: existingAgents.count }, 'Agents already exist, skipping creation');
    }

    logger.info('Database initialization complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Database initialization failed');
    process.exit(1);
  }
}

main();
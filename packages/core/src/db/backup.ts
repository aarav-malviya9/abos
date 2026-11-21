import { getDatabase, closeDatabase } from './index';
import { getConfig } from '../config';
import { logger } from '../logger';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve, join } from 'path';

async function main() {
  try {
    const config = getConfig();
    const dbPath = resolve(config.databasePath);

    if (!existsSync(dbPath)) {
      logger.error({ dbPath }, 'Database file does not exist');
      process.exit(1);
    }

    // Create backup directory
    const backupDir = join(dirname(dbPath), 'backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `abos-backup-${timestamp}.db`);

    // Close database connections to ensure clean backup
    await closeDatabase();

    // Copy database file
    copyFileSync(dbPath, backupPath);

    logger.info({ backupPath }, 'Database backup created successfully');

    // Clean up old backups (keep last 30 days)
    const fs = await import('fs/promises');
    const files = await fs.readdir(backupDir);
    const cutoffDate = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith('abos-backup-') && file.endsWith('.db')) {
        const filePath = join(backupDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs < cutoffDate) {
          await fs.unlink(filePath);
          logger.info({ file }, 'Removed old backup');
        }
      }
    }

    logger.info('Backup process complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Backup failed');
    process.exit(1);
  }
}

main();
import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Find project root by looking for .env in parent directories
function findProjectRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (require('fs').existsSync(resolve(dir, '.env'))) {
      return dir;
    }
    dir = resolve(dir, '..');
    if (dir === '/') break;
  }
  return process.cwd();
}

const projectRoot = findProjectRoot();
dotenv.config({ path: resolve(projectRoot, '.env') });

const configSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  databasePath: z.string().default(resolve(projectRoot, 'data/abos.db')),

  // FreeLLMAPI
  llmApiUrl: z.string().url().default('http://127.0.0.1:31415/v1'),
  llmApiKey: z.string().optional(),
  llmModel: z.string().default('gpt-4o-mini'),

  // n8n
  n8nUrl: z.string().url().default('http://localhost:5678'),
  n8nApiKey: z.string().optional(),

  // API Server
  apiPort: z.coerce.number().default(3001),
  apiHost: z.string().default('0.0.0.0'),

  // Dashboard
  dashboardPort: z.coerce.number().default(3000),
  dashboardUrl: z.string().url().default('http://localhost:3000'),

  // Cloudflare
  cloudflareAccountId: z.string().optional(),
  cloudflareApiToken: z.string().optional(),

  // GitHub
  githubToken: z.string().optional(),
  githubOwner: z.string().optional(),
  githubRepo: z.string().optional(),

  // Feature flags
  enableMockLlm: z.coerce.boolean().default(false),
  enableTelemetry: z.coerce.boolean().default(false),

  // Limits
  maxConcurrentWorkflows: z.coerce.number().default(3),
  workflowTimeoutMs: z.coerce.number().default(300000),
  agentTimeoutMs: z.coerce.number().default(120000),
});

export type Config = z.infer<typeof configSchema>;

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;

  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}
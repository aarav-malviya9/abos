/**
 * Import n8n workflows from JSON files into the local n8n instance.
 * Run: npx ts-node scripts/import-n8n-workflows.ts [n8n-url]
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const WORKFLOW_DIR = resolve(__dirname, '../packages/n8n-workflows/workflows');
const N8N_URL = process.argv[2] || 'http://localhost:5678';
const N8N_USER = process.env.N8N_BASIC_AUTH_USER || 'admin';
const N8N_PASSWORD = process.env.N8N_BASIC_AUTH_PASSWORD || 'changeme';

interface WorkflowJson {
  name: string;
  nodes: Array<{ id: string; name: string; type: string; typeVersion: number; position: [number, number]; parameters?: Record<string, unknown> }>;
}

async function importWorkflow(filePath: string): Promise<void> {
  const raw = readFileSync(filePath, 'utf-8');
  const wf: WorkflowJson = JSON.parse(raw);

  console.log(`\nImporting: ${wf.name}`);

  // Validate nodes
  for (const node of wf.nodes) {
    if (!node.type || !node.id) {
      throw new Error(`Invalid node in "${wf.name}": missing type or id`);
    }
    console.log(`  - ${node.name || node.id} (${node.type})`);
  }

  // Import via n8n API
  const url = `${N8N_URL}/api/v1/workflows`;
  const auth = Buffer.from(`${N8N_USER}:${N8N_PASSWORD}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ ...wf, tags: [], active: false }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to import "${wf.name}": ${response.status} ${text}`);
  }

  const result = await response.json() as { id: string };
  console.log(`  Imported successfully (id: ${result.id})`);
}

async function main() {
  console.log(`n8n URL: ${N8N_URL}`);

  // Check connectivity
  let health: { status?: string } | null = null;
  try {
    const resp = await fetch(`${N8N_URL}/api/v1/healthz`, { signal: AbortSignal.timeout(3000) });
    health = (await resp.json()) as { status?: string };
  } catch {
    // ignore
  }

  if (!health || health.status !== 'ok') {
    console.error('ERROR: n8n is not running or not reachable at', N8N_URL);
    console.error('Start n8n first: npm exec n8n -- --port 5678');
    process.exit(1);
  }

  console.log('n8n is running ✓');

  // Find workflow JSON files
  const files = readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} workflow(s)`);

  for (const file of files) {
    try {
      await importWorkflow(resolve(WORKFLOW_DIR, file));
    } catch (error) {
      console.error(`  FAILED: ${file} — ${(error as Error).message}`);
    }
  }

  console.log('\nDone! Access your workflows at:', `${N8N_URL}/workflows`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

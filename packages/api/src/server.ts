import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { getConfig, logger, apiLogger } from '@abos/core';
import { agentRegistry } from '@abos/agents';

// Import routes
import agentRoutes from './routes/agents';
import projectRoutes from './routes/projects';
import opportunityRoutes from './routes/opportunities';
import crmRoutes from './routes/crm';
import financialRoutes from './routes/financial';
import marketingRoutes from './routes/marketing';
import automationRoutes from './routes/automation';
import reportRoutes from './routes/reports';
import alertRoutes from './routes/alerts';

const config = getConfig();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(helmet());
app.use(cors({ origin: config.dashboardUrl, credentials: true }));
app.use(morgan('combined', { stream: { write: (msg) => apiLogger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/agents', agentRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);

// WebSocket for real-time updates
const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  apiLogger.info('WebSocket client connected');

  ws.on('close', () => {
    clients.delete(ws);
    apiLogger.info('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    apiLogger.error({ error }, 'WebSocket error');
    clients.delete(ws);
  });
});

function broadcast(message: object) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Export broadcast for routes to use
export { broadcast };

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  apiLogger.error({ error: err.message, stack: err.stack, path: req.path }, 'API error');
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize agents and start server
async function start() {
  try {
    await agentRegistry.initialize();
    apiLogger.info('Agent registry initialized');

    server.listen(config.apiPort, config.apiHost, () => {
      apiLogger.info(`API server listening on ${config.apiHost}:${config.apiPort}`);
    });
  } catch (error) {
    apiLogger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();

export default app;
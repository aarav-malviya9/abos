import pino from 'pino';
import { getConfig } from './config';

const config = getConfig();

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  transport: config.nodeEnv !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    service: 'abos',
    environment: config.nodeEnv,
  },
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export const agentLogger = createChildLogger({ component: 'agent' });
export const workflowLogger = createChildLogger({ component: 'workflow' });
export const apiLogger = createChildLogger({ component: 'api' });
export const dbLogger = createChildLogger({ component: 'database' });
export const llmLogger = createChildLogger({ component: 'llm' });
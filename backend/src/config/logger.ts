import pino from 'pino';
import { config } from './index';

const logger = pino({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  transport: config.nodeEnv === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'ai-interview-backend',
  },
});

export default logger;

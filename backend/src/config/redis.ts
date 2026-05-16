import Redis from 'ioredis';
import { config } from './index';

const redisClient = new Redis(config.redis.url, {
  tls: config.redis.url.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

export default redisClient;

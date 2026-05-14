import Redis from 'ioredis';
import { config } from './index';

const redisClient = new Redis(config.redis.url);

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

export default redisClient;

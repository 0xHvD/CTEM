const redis = require('redis');
const logger = require('../utils/logger');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;

// Create client only when needed
const createClient = () => {
  if (client) return client;
  
  client = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 20) {
          logger.error('Redis reconnection attempts exhausted');
          return new Error('Redis reconnection failed');
        }
        return Math.min(retries * 50, 1000);
      }
    }
  });

  client.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    logger.info('Redis Client Connected');
  });

  client.on('ready', () => {
    logger.info('Redis Client Ready');
  });

  client.on('end', () => {
    logger.info('Redis Client Disconnected');
  });

  client.on('reconnecting', () => {
    logger.info('Redis Client Reconnecting...');
  });

  return client;
};

// Connect to Redis with error handling
const connectRedis = async () => {
  try {
    const redisClient = createClient();
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info('Redis connection established successfully');
    }
    return redisClient;
  } catch (err) {
    logger.error('Redis connection failed:', err);
    logger.warn('Application will continue without Redis caching');
    return null;
  }
};

// Graceful Redis operations
const safeRedisOperation = async (operation) => {
  try {
    const redisClient = createClient();
    if (!redisClient.isOpen) {
      logger.warn('Redis not connected, skipping operation');
      return null;
    }
    return await operation(redisClient);
  } catch (error) {
    logger.error('Redis operation failed:', error);
    return null;
  }
};

// Graceful shutdown
const disconnect = async () => {
  if (client && client.isOpen) {
    await client.disconnect();
    logger.info('Redis client disconnected');
  }
};

// Only auto-connect in production/server mode
if (process.env.NODE_ENV === 'production' || process.argv[1].includes('server.js')) {
  connectRedis();
}

// Export client with safe operations
module.exports = {
  connect: connectRedis,
  disconnect,
  get: (key) => safeRedisOperation((client) => client.get(key)),
  set: (key, value, options) => safeRedisOperation((client) => client.set(key, value, options)),
  del: (key) => safeRedisOperation((client) => client.del(key)),
  flushall: () => safeRedisOperation((client) => client.flushAll()),
  setex: (key, seconds, value) => safeRedisOperation((client) => client.setEx(key, seconds, value)),
  incr: (key) => safeRedisOperation((client) => client.incr(key)),
  expire: (key, seconds) => safeRedisOperation((client) => client.expire(key, seconds)),
  ping: () => safeRedisOperation((client) => client.ping()),
  isConnected: () => client ? client.isOpen : false,
  quit: () => disconnect()
};
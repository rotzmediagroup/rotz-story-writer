import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType;

export async function connectRedis(): Promise<void> {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            logger.error('Redis reconnection attempts exceeded');
            return false;
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // Error handling
    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    redisClient.on('connect', () => {
      logger.debug('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready');
    });

    redisClient.on('end', () => {
      logger.warn('Redis client connection ended');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    // Connect to Redis
    await redisClient.connect();

    // Test connection
    await redisClient.ping();
    logger.info('✅ Redis connected successfully');

  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redisClient;
}

// Cache utilities
export class RedisCache {
  private client: RedisClientType;
  private defaultTTL: number;

  constructor(ttl: number = 3600) { // Default 1 hour
    this.client = getRedisClient();
    this.defaultTTL = ttl;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expireTime = ttl || this.defaultTTL;
      
      await this.client.setEx(key, expireTime, serialized);
      return true;
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      logger.error(`Redis exists error for key ${key}:`, error);
      return false;
    }
  }

  async increment(key: string, ttl?: number): Promise<number> {
    try {
      const result = await this.client.incr(key);
      
      if (result === 1 && ttl) {
        await this.client.expire(key, ttl);
      }
      
      return result;
    } catch (error) {
      logger.error(`Redis increment error for key ${key}:`, error);
      return 0;
    }
  }

  async getKeys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Redis keys error for pattern ${pattern}:`, error);
      return [];
    }
  }

  async flushPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.getKeys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.client.del(keys);
      return result;
    } catch (error) {
      logger.error(`Redis flush pattern error for ${pattern}:`, error);
      return 0;
    }
  }
}

// Progress tracking utilities
export class ProgressTracker {
  private cache: RedisCache;

  constructor() {
    this.cache = new RedisCache(7200); // 2 hours TTL for progress
  }

  async setProgress(sessionId: string, progress: ProgressData): Promise<void> {
    const key = `progress:${sessionId}`;
    await this.cache.set(key, {
      ...progress,
      timestamp: Date.now(),
    });
  }

  async getProgress(sessionId: string): Promise<ProgressData | null> {
    const key = `progress:${sessionId}`;
    return await this.cache.get<ProgressData>(key);
  }

  async deleteProgress(sessionId: string): Promise<void> {
    const key = `progress:${sessionId}`;
    await this.cache.delete(key);
  }

  async setStoryGenerationSession(
    storyId: string, 
    sessionData: GenerationSessionData
  ): Promise<void> {
    const key = `generation:${storyId}`;
    await this.cache.set(key, sessionData, 14400); // 4 hours TTL
  }

  async getStoryGenerationSession(storyId: string): Promise<GenerationSessionData | null> {
    const key = `generation:${storyId}`;
    return await this.cache.get<GenerationSessionData>(key);
  }

  async deleteStoryGenerationSession(storyId: string): Promise<void> {
    const key = `generation:${storyId}`;
    await this.cache.delete(key);
  }
}

// Rate limiting utilities
export class RateLimiter {
  private cache: RedisCache;

  constructor() {
    this.cache = new RedisCache();
  }

  async checkRateLimit(
    identifier: string, 
    maxRequests: number, 
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const resetTime = now + (windowSeconds * 1000);

    try {
      const current = await this.cache.increment(key, windowSeconds);
      
      const remaining = Math.max(0, maxRequests - current);
      const allowed = current <= maxRequests;

      return {
        allowed,
        remaining,
        resetTime,
      };
    } catch (error) {
      logger.error(`Rate limit check error for ${identifier}:`, error);
      // Fail open in case of Redis issues
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime,
      };
    }
  }
}

// Type definitions
export interface ProgressData {
  stage: 'planning' | 'generating' | 'assembling' | 'complete' | 'failed';
  progress: number; // 0-100
  currentChapter?: number;
  totalChapters?: number;
  message?: string;
  timestamp?: number;
}

export interface GenerationSessionData {
  storyId: string;
  userId: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  startedAt: number;
  currentChapter: number;
  totalChapters: number;
  aiProvider: string;
  estimatedTimeRemaining?: number;
  errorMessage?: string;
}

// Session store for express-session
export class RedisSessionStore {
  private client: RedisClientType;
  private prefix: string;
  private ttl: number;

  constructor(prefix = 'session:', ttl = 86400) { // 24 hours default
    this.client = getRedisClient();
    this.prefix = prefix;
    this.ttl = ttl;
  }

  async get(sessionId: string): Promise<any> {
    try {
      const data = await this.client.get(this.prefix + sessionId);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Session get error for ${sessionId}:`, error);
      return null;
    }
  }

  async set(sessionId: string, session: any): Promise<void> {
    try {
      const data = JSON.stringify(session);
      await this.client.setEx(this.prefix + sessionId, this.ttl, data);
    } catch (error) {
      logger.error(`Session set error for ${sessionId}:`, error);
      throw error;
    }
  }

  async destroy(sessionId: string): Promise<void> {
    try {
      await this.client.del(this.prefix + sessionId);
    } catch (error) {
      logger.error(`Session destroy error for ${sessionId}:`, error);
      throw error;
    }
  }

  async touch(sessionId: string): Promise<void> {
    try {
      await this.client.expire(this.prefix + sessionId, this.ttl);
    } catch (error) {
      logger.error(`Session touch error for ${sessionId}:`, error);
      throw error;
    }
  }
}

export { redisClient };
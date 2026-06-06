import type { GameRoom } from './types';

const ROOM_TTL = 86400;

// In-memory fallback for local dev without Upstash
const memStore = new Map<string, GameRoom>();

function isRedisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let _redis: import('@upstash/redis').Redis | null = null;

async function getRedis() {
  if (!_redis) {
    const { Redis } = await import('@upstash/redis');
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

const key = (code: string) => `room:${code}`;

export async function getRoom(code: string): Promise<GameRoom | null> {
  if (!isRedisConfigured()) return memStore.get(key(code)) ?? null;
  const redis = await getRedis();
  return redis.get<GameRoom>(key(code));
}

export async function setRoom(room: GameRoom): Promise<void> {
  if (!isRedisConfigured()) { memStore.set(key(room.code), room); return; }
  const redis = await getRedis();
  await redis.setex(key(room.code), ROOM_TTL, room);
}

export async function deleteRoom(code: string): Promise<void> {
  if (!isRedisConfigured()) { memStore.delete(key(code)); return; }
  const redis = await getRedis();
  await redis.del(key(code));
}

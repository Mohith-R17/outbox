import { redisConnection } from '../config/redis';

/**
 * Lua Script for atomic rate limit and delay reservation.
 * 
 * KEYS[1]: rate_key (e.g. email-rate:senderId:hourBucket)
 * KEYS[2]: delay_key (e.g. email-delay:senderId)
 * 
 * ARGV[1]: max_emails (limit per hour)
 * ARGV[2]: current_time (current timestamp in ms)
 * ARGV[3]: window_ttl_ms (ms until the end of the current hour)
 * ARGV[4]: min_delay_ms (ms minimum between emails for the same sender)
 */
const RESERVE_SCRIPT = `
local rate_key = KEYS[1]
local delay_key = KEYS[2]

local max_emails = tonumber(ARGV[1])
local current_time = tonumber(ARGV[2])
local window_ttl_ms = tonumber(ARGV[3])
local min_delay_ms = tonumber(ARGV[4])

-- Check Rate Limit
local count = tonumber(redis.call('GET', rate_key) or '0')
if count >= max_emails then
    return {-1, 0}
end

-- Calculate wait time based on next_send
local next_send = tonumber(redis.call('GET', delay_key) or '0')
local wait_time = math.max(0, next_send - current_time)

-- Reserve Rate Limit
redis.call('INCR', rate_key)
if count == 0 then
    redis.call('PEXPIRE', rate_key, window_ttl_ms)
end

-- Reserve Next Send
local new_next_send = current_time + wait_time + min_delay_ms
redis.call('SET', delay_key, new_next_send)
-- Ensure the key expires to save memory, safely covering the wait + minimum interval
redis.call('PEXPIRE', delay_key, wait_time + min_delay_ms + 10000)

return {1, wait_time}
`;

export const reserveEmailCapacity = async (
  senderId: string,
  maxPerHour: number,
  minDelayMs: number
): Promise<{ allowed: boolean; waitTime: number }> => {
  const now = Date.now();
  const currentHourBucket = Math.floor(now / 3600000);
  
  const rateKey = `email-rate:${senderId}:${currentHourBucket}`;
  const delayKey = `email-delay:${senderId}`;
  
  // Calculate remaining ms in the current hour for TTL
  const nextHourMs = (currentHourBucket + 1) * 3600000;
  const windowTtlMs = nextHourMs - now;

  const result = await redisConnection.eval(
    RESERVE_SCRIPT,
    2,
    rateKey,
    delayKey,
    maxPerHour,
    now,
    windowTtlMs,
    minDelayMs
  ) as [number, number];

  const [status, waitTime] = result;

  return {
    allowed: status === 1,
    waitTime: waitTime,
  };
};

export const getMsUntilNextHour = (): number => {
  const now = Date.now();
  const currentHourBucket = Math.floor(now / 3600000);
  const nextHourMs = (currentHourBucket + 1) * 3600000;
  return nextHourMs - now;
};

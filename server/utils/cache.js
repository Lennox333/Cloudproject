import Memcached from "memcached";
import util from "node:util";
import { getConfig } from "./envManager.js";

const { MEMECACHE_ADDR } = await getConfig();

// const MEMECACHE_ADDR = "a2-gr41.km2jzi.cfg.apse2.cache.amazonaws.com:11211"
const memcached = new Memcached(MEMECACHE_ADDR);
memcached.aGet = util.promisify(memcached.get);
memcached.aSet = util.promisify(memcached.set);

/**
 * Cache admin status
 */
function cacheAdminStatus(userId, isAdmin) {
  memcached
    .aSet(`admin:${userId}`, isAdmin, 300) // 5 min TTL
    .then(() =>
      console.log(`[Cache] Admin status cached for ${userId}: ${isAdmin}`)
    )
    .catch((err) =>
      console.warn(
        `[Cache] Failed to cache admin status for ${userId}: ${err.message}`
      )
    );
}

/**
 * Get cached admin status
 */
async function getCachedAdminStatus(userId) {
  const value = await memcached.aGet(`admin:${userId}`);
  if (value !== undefined && value !== null) {
    console.log(`[Cache] Admin status retrieved for ${userId}: ${value}`);
  } else {
    console.log(`[Cache] Admin status cache miss for ${userId}`);
  }
  return value; // null if missing
}

/**
 * Cache presigned URL
 */
function cachePresignedUrl(key, url, ttlSeconds) {
  memcached
    .aSet(`url:${key}`, url, ttlSeconds)
    .then(() => console.log(`[Cache] Presigned URL cached for ${key}`))
    .catch((err) =>
      console.warn(
        `[Cache] Failed to cache presigned URL for ${key}: ${err.message}`
      )
    );
}

/**
 * Get cached presigned URL
 */
async function getCachedPresignedUrl(key) {
  const value = await memcached.aGet(`url:${key}`);
  if (value !== undefined && value !== null) {
    console.log(`[Cache] Presigned URL retrieved for ${key}`);
  } else {
    console.log(`[Cache] Presigned URL cache miss for ${key}`);
  }
  return value; // null if missing
}

export {
  cacheAdminStatus,
  getCachedAdminStatus,
  cachePresignedUrl,
  getCachedPresignedUrl,
};

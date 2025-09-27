import Memcached from "memcached";
import util from "node:util";
import { getConfig } from "./envManager";

const { MEMECACHE_ADDR } = await getConfig();

const memcached = new Memcached(MEMECACHE_ADDR);
memcached.aGet = util.promisify(memcached.get);
memcached.aSet = util.promisify(memcached.set);

/**
 * Cache admin status
 */
async function cacheAdminStatus(userId, isAdmin) {
  await memcached.aSet(`admin:${userId}`, isAdmin, 300); // 5 min TTL
}

/**
 * Get cached admin status
 */
async function getCachedAdminStatus(userId) {
  const value = await memcached.aGet(`admin:${userId}`);
  return value; // null if missing
}

/**
 * Cache presigned URL
 */
async function cachePresignedUrl(key, url, ttlSeconds) {
  await memcached.aSet(`url:${key}`, url, ttlSeconds);
}

/**
 * Get cached presigned URL
 */
async function getCachedPresignedUrl(key) {
  const value = await memcached.aGet(`url:${key}`);
  return value; // null if missing
}

export {
  cacheAdminStatus,
  getCachedAdminStatus,
  cachePresignedUrl,
  getCachedPresignedUrl,
};

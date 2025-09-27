import Memcached from "memcached";
import util from "node:util";

// Replace this with the endpoint for your Elasticache instance
const memcachedAddress = "YOUR_ELASTICACHE_ENDPOINT:11211";

var memcachedClient = false;

function connectToMemcached() {
  memcachedClient = new Memcached(memcachedAddress);
  memcachedClient.on("failure", (details) => {
    console.log("Memcached server failure: ", details);
  });
  // Monkey patch some functions for convenience
  // We can call these with async
  memcachedClient.aGet = util.promisify(memcachedClient.get);
  memcachedClient.aSet = util.promisify(memcachedClient.set);
  memcachedClient.aDel = util.promisify(memcachedClient.del);
}

// Implement a generic caching function
export async function cachedFetch(key, fetchFunction, ttlSeconds) {
  if (!memcachedClient) {
    console.log("Memcached not connected. Skipping cache.");
    return await fetchFunction();
  }

  try {
    const value = await memcachedClient.aGet(key);
    if (value) {
      console.log(`Cache hit for key: ${key}`);
      return value;
    }
  } catch (err) {
    console.error(`Memcached GET error for key ${key}:`, err);
    // Continue without cache on error
  }

  console.log(`Cache miss for key: ${key}`);
  const fetchedValue = await fetchFunction();

  if (fetchedValue) {
    try {
      await memcachedClient.aSet(key, fetchedValue, ttlSeconds);
    } catch (err) {
      console.error(`Memcached SET error for key ${key}:`, err);
    }
  }

  return fetchedValue;
}

export function invalidateCache(key) {
  if (memcachedClient) {
    try {
      memcachedClient.aDel(key);
      console.log(`Cache invalidated for key: ${key}`);
    } catch (err) {
      console.error(`Memcached DEL error for key ${key}:`, err);
    }
  }
}

// Call this once on server startup
connectToMemcached();
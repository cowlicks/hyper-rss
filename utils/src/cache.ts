const DEFAULT_CACHE_SIZE = 1e3;

export class FifoMap extends Map {
  maxSize: number;

  constructor (maxSize) {
    super();
    Object.assign(this, { maxSize });
  }

  set (key, val) {
    super.set(key, val);
    if (this.size > this.maxSize) {
      this.delete(this.keys().next().value);
    }
    return this;
  }
}

/* Least Recently Used Cache
 * here "used" is just `.get`
 */
export class LruMap extends Map {
  maxSize: number;

  constructor ({ maxSize = DEFAULT_CACHE_SIZE } = {}) {
    super();
    Object.assign(this, { maxSize });
  }

  set (key, val) {
    super.set(key, val);
    if (this.size > this.maxSize) {
      this.delete(this.keys().next().value);
    }
    return this;
  }

  get (key) {
    const out = super.get(key);
    const had = this.delete(key);
    if (had) {
      this.set(key, out);
    }
    return out;
  }
}

export function timedCache (func, lifetime, hash = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return (...args) => {
    const key = hash(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func(...args);
    cache.set(key, result);
    setTimeout(() => cache.delete(key), lifetime);
    return result;
  };
}

/*
 * Memoize the function `func`. `hash` coneverts the functions arguments into a
 * key to reference the result in the cache. `size` is the max size of the
 * cache.
 */
export function memoize (func, hash = (...args) => JSON.stringify(args), size = 100) {
  const cache = new FifoMap(size);
  return (...args) => {
    const key = hash(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = func(...args);
    cache.set(key, result);
    return result;
  };
}

export function asyncMemoize (func, hash = (...args) => JSON.stringify(args), size = 100) {
  const cache = new FifoMap(size);
  return async (...args) => {
    const key = hash(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = await func(...args);
    cache.set(key, result);
    return result;
  };
}

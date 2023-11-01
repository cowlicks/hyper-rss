import { stableStringify } from '@hrss/utils';

export const DEFAULT_CACHE_HASH = (...x) => stableStringify(x);
// func, funcName, funcHash
// for each provide { func, name, hash }
// this becomes Map<name, [hash, func]>
// cache is Map<cacheKey,result>
/*
 * TODO add cache invalidation
 * TODO seperate actuall cache put/get from cache func call
 * func put/get does not need the function itself
 */
export class ApiCache {
  constructor ({
    funcs = new Map(),
    cache = new Map(),
  } = {}) {
    Object.assign(
      this,
      {
        funcs,
        cache,
      },
    );
  }

  getCached ([name, params]) {
    if (!this.funcs.has(name)) {
      // maybe this behaviour could be configed by a callback
      throw new Error(`This function is not cached! name: [${name}] params: [${params}]`);
    }

    const [hash, func] = this.funcs.get(name);
    const key = hash(name, params);
    return {
      cached: this.cache.has(key),
      value: this.cache.get(key),
      key,
      func,
    };
  }

  // TODO add sync and async versions
  get ([name, params]) {
    if (!this.funcs.has(name)) {
      throw new Error(`This function is not cached! name: [${name}] params: [${params}]`);
    }
    const { cached, value, key, func } = this.getCached([name, params]);
    if (cached) {
      return value;
    }
    // TODO handle error if this errrrs
    const result = func(...params);
    this.cache.set(key, result);
    return result;
  }

  addFunction (name, func, { hasher = DEFAULT_CACHE_HASH } = {}) {
    this.funcs.set(name, [hasher, func]);
  }

  invalidate (regex) {
    return ([...this.cache.keys()]
      .filter(k => k.match(regex))
      .map(match => {
        this.cache.delete(match);
        return match;
      }));
  }
}

export function cacheMethodOnObject (cache, object, methodName, { hasher = DEFAULT_CACHE_HASH } = {}) {
  const func = object[methodName].bind(object);
  cache.addFunction(methodName, func, { hasher });
  const cachedFunc = (...params) => cache.get([methodName, params]);
  object[methodName] = cachedFunc;
}

export function addInvalidationOnObjectMethod (cache, object, methodName, makeRegex) {
  const func = object[methodName].bind(object);

  const funcWithInvalidation = (...params) => {
    const regex = makeRegex(params);
    // Should we do this before or after we call the func?
    cache.invalidate(regex);
    return func(...params);
  };
  object[methodName] = funcWithInvalidation;
}

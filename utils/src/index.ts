export * from './async.js';
export * from './iter.js';
export * from './target.js';
export * from './websocket.js';
export * from './logging.js';
export * from './cache.js';
export * from './config.js';
export * from './messages.js';

export const clone = (o: any) => JSON.parse(JSON.stringify(o));
export const prettyStrigify = (o: any) => JSON.stringify(o, null, 2);

export const hasOwnProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
export const { assign } = Object;

const isNullishSentinel = Symbol('isNullish sentinel');
export function isNullish(x) {
  return (x ?? isNullishSentinel) === isNullishSentinel;
}

const { isArray } = Array;
function isObject(item) {
  return (item && typeof item === 'object' && !isArray(item));
}

export function asArray(x) {
  return Array.isArray(x) ? x : [x];
}

// simple deep merge of source into target, NB this mutates the target
export function deepMerge(target, source) {
  for (const key in source) {
    if (isArray(target[key]) && isArray(source[key])) {
      mergeObjectArrays(target[key], source[key]); // eslint-disable-line no-use-before-define
    } else if (!isObject(source[key]) || !hasOwnProperty(target, key) || !isObject(target[key])) {
      target[key] = source[key];
    } else {
      deepMerge(target[key], source[key]);
    }
  }
  return target;
}

function mergeObjectArrays(target, source) {
  for (let i = 0; i < target.length && i < source.length; i++) {
    if (typeof target[i] === 'object' && typeof source[i] === 'object') {
      deepMerge(target[i], source[i]);
    }
  }
}

export function arraySet(array, index, value) {
  if (array.length < index + 1) { // to mimic behavior of x[i] = v when x.length < x
    array.length = index + 1;
  }
  return array.splice(index, 1, value);
}

// filter an array in place, and in a Vue friendly way
export function filterInPlace<T>(arr: T[], condition, thisArg = null): T[] {
  const out = [];
  let j = 0;

  arr.forEach((value, index) => {
    if (condition.call(thisArg, value, index, arr)) {
      if (index !== j) {
        out.push(...arr.splice(j, 1, value));
      }
      j += 1;
    }
  });

  arr.splice(j);
  return out;
}

export function refresh() {
  history.go(); // eslint-disable-line no-restricted-globals
}

export function go(path = '') {
  const url = new URL(window.location.href);
  url.hash = path.startsWith('/') ? path : `/${path}`;
  window.location.href = url.href;
}

export function pluck(name: string) {
  return (obj) => obj[name];
}

export function intersect(left, right) {
  const rightSet = new Set([...right]);
  return new Set([...left].filter((x) => rightSet.has(x)));
}

export function difference(left, right) {
  const rightSet = new Set([...right]);
  return new Set([...left].filter((x) => !rightSet.has(x)));
}

export function differencesAndIntersection(leftIn, rightIn) {
  const left = difference(leftIn, rightIn),
    right = difference(rightIn, leftIn),
    intersection = intersect(leftIn, rightIn);
  return { left, intersection, right };
}


export function mapObject(obj: {[s: string]: unknown;} | ArrayLike<unknown>, func: (value: [string, unknown], index: number, array: [string, unknown][]) => readonly [PropertyKey, any]) {
  return Object.fromEntries(Object.entries(obj).map(func));
}

export function filterObject(obj, func) {
  return Object.fromEntries(Object.entries(obj).filter(func));
}

export function isPrimitive(test: unknown) {
  return test !== Object(test);
}

export function shallowCopy(x) {
  if (isPrimitive(x)) return x;
  if (Array.isArray(x)) return [...x];
  return { ...x };
}

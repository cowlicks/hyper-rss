import { Target } from '@hrss/utils';
import { open, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ENCODING } from '../const.js';

export * from './net.js';

const alph = 'abcdefghijklmnopqrstuvwxyz';

export const randName = (len = 6) => {
  return new Array(len).fill(0).map(() => alph[Math.floor(Math.random() * 26)]).join('');
};

const EXIT_EVENTS = [
  'exit',
  'SIGTERM',
  'SIGINT',
];
let _onExit = null;

export const getOnExit = () => {
  if (_onExit !== null) {
    return _onExit;
  }
  _onExit = new Target();
  EXIT_EVENTS.forEach(eventName => process.on(eventName, (...exitArgs) => _onExit.dispatch(exitArgs)));
  return _onExit;
};

export function encodedStrFromBuffer (buffer) {
  return Buffer.from(buffer).toString(ENCODING);
}

export function bufferFromEncodedStr (encodedStr) {
  return Buffer.from(encodedStr, ENCODING);
}

export async function writeFile (fileName, data, options = {}) {
  if (options.createDir) {
    const dir = dirname(fileName);
    await mkdir(dir, { recursive: true });
  }
  const fh = await open(fileName, 'w+');
  await fh.write(data);
  await fh.close();
}

export async function writeJsonFile (fileName, data) {
  await writeFile(fileName, JSON.stringify(data));
}

export async function readJsonFile (fileName) {
  const fh = await open(fileName);
  const out = JSON.parse(await fh.readFile());
  await fh.close();
  return out;
}
export async function asyncThrows (fn) {
  try {
    await fn();
  } catch (e) {
    return true;
  }
  return false;
}

export async function fileExists (path) {
  return !(await asyncThrows(() => stat(path)));
}

export function objectMap (o, func) {
  return Object.fromEntries(func([...Object.entries(o)]));
}

export const renameFields = (obj, renames) => {
  const renameMap = new Map(renames);
  return objectMap(obj, kvArr => {
    return kvArr.map(([k, v]) => (renameMap.has(k) ? [renameMap.get(k), v] : [k, v]));
  });
};

export function orderObjArr (ordering, elements) {
  const orderSet = new Set(ordering);
  const elementMap = new Map(elements);
  const out = [];
  for (const o of orderSet) {
    if (elementMap.has(o)) {
      out.push([o, elementMap.get(o)]);
      elementMap.delete(o);
    }
  }
  out.push(...elementMap.entries());
  return out;
}

export function orderObj (ordering, o) {
  return objectMap(o, arr => orderObjArr(ordering, arr));
}

export function filterObj (filterFields, o) {
  const filters = new Set(filterFields);
  return objectMap(o, arr => arr.filter(([k, _v]) => !filters.has(k)));
}

// Like python's context managers. We wrap the provided `func` with `enter` and
// `exit` calls.
//
// NB we only access enter/func/exit at call time to allow them
// to be added `obj` dynamically in then enter/func functions.
export async function withContext (
  obj,
) {
  const ctx = await obj.enter();
  try {
    const result = await obj.func(ctx);
    await obj.exit({ ctx, result });
    return result;
  } catch (error) {
    console.log(error);
    await obj.exit({ ctx, error });
    throw error;
  }
}
export const identity = (x) => x;

import { open, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ENCODING } from '../const.js';

export * from './net.js';

const alph = 'abcdefghijklmnopqrstuvwxyz';

export const randName = (len = 6) => {
  return new Array(len).fill(0).map(() => alph[Math.floor(Math.random() * 26)]).join('');
};

// For fully featured listener see privacypossum src/js/utils:listenerMixin
class EventListener {
  constructor () {
    this.funcs = new Set();
  }

  addListener (func) {
    this.funcs.add(func);
  }

  onEvent (event_) {
    return this.funcs.map(func => func(event_));
  }
}

const EXIT_EVENTS = [
  'exit',
  'SIGINT',
  'SIGTERM'
];
let _onExit = null;

export const getOnExit = () => {
  if (_onExit !== null) {
    return _onExit;
  }
  _onExit = new EventListener();
  EXIT_EVENTS.forEach(eventName => process.on(eventName, (...exitArgs) => _onExit.onEvent(exitArgs)));
  return _onExit;
};

export function encodedStrFromBuffer (buffer) {
  return Buffer.from(buffer).toString(ENCODING);
}

export function bufferFromEncodedStr (encodedStr) {
  return Buffer.from(encodedStr, ENCODING);
}

// Eventualy we should move this async stuff it's own library

/// A promise that can be controlled externally with `.reject` and `.catch` methods.
export function Deferred () {
  const o = {};
  const p = new Promise((resolve, reject) => Object.assign(o, { resolve, reject }));
  const rejectAndCatch = (rejectionReason, catchFunc = () => {}) => {
    (o).reject(rejectionReason);
    p.catch(catchFunc);
  };
  return Object.assign(p, o, { rejectAndCatch });
}

const QueueDone = Symbol('QueueDone');

function _box (x) {
  return [x];
}

function _unbox (x) {
  return x[0];
}

export class AsyncQueue {
  constructor () {
    Object.assign(this, {
      _queue: [],
      _waiter: null,
      _done: false,
      name: randName()
    });
  }

  async get () {
    return _unbox(await this._get());
  }

  async addAsyncIter (stream) {
    for await (const x of stream) {
      this.push(x);
    }
  }

  _get () {
    if (this._queue.length) {
      return this._queue.shift();
    }
    if (!this._waiter) {
      this._waiter = Deferred();
    }
    return this._waiter;
  }

  get size () {
    return this._queue.length;
  }

  _addFunc (x, func) {
    if (this._done) {
      throw new Error('Cannot push on a done queue');
    }
    if (this._waiter) {
      this._waiter.resolve(_box(x));
      this._waiter = null;
    } else {
      func(_box(x));
    }
  }

  push (...stuff) {
    stuff.forEach((x) => {
      this._addFunc(x, (y) => this._queue.push(y));
    });
    return this;
  }

  unshift (...stuff) {
    stuff.forEach((x) => {
      this._addFunc(x, (y) => this._queue.unshift(y));
    });
    return this;
  }

  done () {
    this._done = true;
    if (!this._waiter) {
      this._waiter = Deferred();
    }
    this._waiter.resolve(QueueDone);
  }

  [Symbol.asyncIterator] () {
    const self = this;
    return {
      async next () {
        const value = await self._get();
        if (value === QueueDone) {
          return { done: true };
        }

        return { done: false, value: _unbox(value) };
      }
    };
  }
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

export async function withContext ({ enter = async () => {}, exit = async () => {}, func = async () => {} }) {
  const ctx = await enter();
  try {
    const result = await func(ctx);
    await exit({ ctx, result });
    return result;
  } catch (error) {
    console.log(error);
    await exit({ ctx, error });
    throw error;
  }
}
export const identity = (x) => x;

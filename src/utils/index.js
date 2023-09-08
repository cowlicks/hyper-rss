import { open } from 'node:fs/promises';

export * from './net.js';

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

export function base64FromBuffer (buffer) {
  return Buffer.from(buffer).toString('base64');
}

export function bufferFromBase64 (base64Str) {
  return Buffer.from(base64Str, 'base64');
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
      _done: false
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

export async function writeJsonFile (fileName, data) {
  const fh = await open(fileName, 'w+');
  await fh.write(JSON.stringify(data));
  await fh.close();
}

export async function readJsonFile (fileName) {
  const fh = await open(fileName);
  return JSON.parse(await fh.readFile());
}

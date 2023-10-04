import config from './config.js';

export interface IDeferred<T> extends Promise<T> {
  resolve: (x?: T) => void;
  reject: (x?: unknown) => void;
  rejectAndCatch: (rejectionReason: unknown, catchFunc?: (x: unknown) => unknown) => void;
}

export function Deferred (): IDeferred<unknown> {
  const o = {};
  const p = new Promise((resolve, reject) => Object.assign(o, { resolve, reject }));
  const rejectAndCatch = (rejectionReason, catchFunc = () => {}) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    o.reject(rejectionReason);
    p.catch(catchFunc);
  };
  return Object.assign(p, o, { rejectAndCatch }) as IDeferred<unknown>;
}

export class TimeoutError extends Error {
  name = 'TimeoutError';

  constructor (message = 'Something took too long') {
    super(message);
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

interface IWait<T> extends IDeferred<T> {
  stop: () => void;
}

export function wait (ms: number): IWait<void> {
  const d = Deferred();
  const timeoutId = setTimeout(() => d.resolve(), ms);
  (d as IWait<void>).stop = () => {
    clearTimeout(timeoutId);
    d.resolve();
  };
  return d as IWait<void>;
}

export async function timeout<T> (
  awaitable: Promise<T>,
  { wait: waitTime = config.TIMEOUT, thrown = new TimeoutError() } = {},
) {
  const thrower = async () => {
    await wait(waitTime);
    throw thrown;
  };
  return Promise.race([awaitable, thrower()]);
}

export async function * waits (times: Iterable<number>) {
  for (const t of times) {
    await wait(t); // eslint-disable-line no-await-in-loop
    yield t;
  }
}

export function * fToGen (f: (number) => number, x0 = 0) {
  let x = x0;
  yield x;
  while (true) {
    yield x = f(x);
  }
}

export function toDeferred<T> (p: Promise<T>): IDeferred<T> {
  const out = Deferred() as IDeferred<T>;
  p.then(out.resolve);
  p.catch(out.reject);
  return out;
}

export function cancellable (iter) {
  const deferred = Deferred();
  return {
    [Symbol.asyncIterator] (): AsyncIterator<unknown> {
      return {
        async next () {
          return Promise.race([iter.next(), deferred]);
        },
      };
    },
    cancel () {
      deferred.resolve({ done: true });
    },
  };
}

export class Retryer {
  frequency: number;

  limit: number;

  inProgress = false;

  result: unknown;

  stopLoop = () => {};

  constructor (frequency = 2000, limit = 10) {
    Object.assign(this, { frequency, limit });
  }

  onSuccess (result) {
    this.result = result;
    this.stop();
  }

  stop () {
    this.inProgress = false;
    this.stopLoop();
  }

  async retry (callback) {
    if (this.inProgress) return;
    this.inProgress = true;
    let count = 0;
    const iterable = cancellable(waits(fToGen((x) => x * 2, this.frequency)));
    this.stopLoop = iterable.cancel.bind(iterable);

    for await (const _ of iterable) {
      callback(this.onSuccess.bind(this));
      count += 1;
      if (count >= this.limit) {
        this.stop();
        return;
      }
    }
    this.stop();
  }
}

const QueueDone = Symbol('QueueDone');

function _box (x) {
  return [x];
}

function _unbox (x) {
  return x[0];
}

export class AsyncQueue<T> {
  _queue = [];

  _waiter: IDeferred<unknown> | null = null;

  _done = false;

  async get () {
    return _unbox(await this._get());
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

  _addFunc (x: unknown[], func) {
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
    return this._waiter.resolve(QueueDone);
  }

  close () {
    return this.done();
  }

  [Symbol.asyncIterator] () {
    const self = this;
    return {
      async next () {
        const value = await self._get();
        if (value === QueueDone) {
          return { done: true } as { done: boolean, value: undefined };
        }

        return { done: false, value: _unbox(value) } as { done: boolean, value: T};
      },
    };
  }
}

// combine async iterators into one
export function combine<T> (...aiters: AsyncIterable<T>[]): AsyncIterable<T> {
  const queue: AsyncQueue<T> = new AsyncQueue();
  const naiters = aiters.length;
  let nfinished = 0;
  aiters.map(async (aiter) => {
    for await (const x of aiter) {
      queue.push(x);
    }
    nfinished += 1;
    if (nfinished === naiters) {
      queue.done();
    }
  });
  return queue;
}

export function unique (iterable, hashFunc = (x) => x) {
  const seen = new Set();
  return {
    [Symbol.iterator] () {
      const iterator = iterable[Symbol.iterator]();
      return {
        next () {
          const res = iterator.next();
          if (res?.done) return res;
          const hash = hashFunc(res.value);
          if (!seen.has(hash)) {
            seen.add(hash);
            return res;
          }
          return this.next();
        },
      };
    },
    [Symbol.asyncIterator] () {
      const iterator = iterable[Symbol.asyncIterator]();
      return {
        async next () {
          const res = await iterator.next();
          if (res?.done) return res;
          const hash = hashFunc(res.value);
          if (!seen.has(hash)) {
            seen.add(hash);
            return res;
          }
          return this.next();
        },
      };
    },
  };
}

export function asCompleted<T> (...args: Promise<T>[]): AsyncIterable<T> {
  const queue: AsyncQueue<T> = new AsyncQueue();
  const running = new Set();
  args.forEach((p) => {
    running.add(p);
    p.then((x) => queue.push(x))
      .catch(() => undefined)
      .finally(() => {
        running.delete(p);
        if (!running.size) {
          queue.done();
        }
      });
  });
  return queue;
}

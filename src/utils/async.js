export function wait (millis) {
  return new Promise((resolve, _reject) => setTimeout(resolve, millis));
}

const DEFAULT_RETRY_BACKOFF_INTERVAL = 100;
const DEFAULT_RETRY_BACKOFF = () => periodicWaits(DEFAULT_RETRY_BACKOFF_INTERVAL);
const DEFAULT_RETRY_TIMEOUT = 20 * 1e3;
const DEFAULT_RETRY_ATTEMPTS = 200;

export async function retry (
  func,
  {
    attemps = DEFAULT_RETRY_ATTEMPTS,
    timeout = DEFAULT_RETRY_TIMEOUT,
    backoff = DEFAULT_RETRY_BACKOFF
  } = {}) {
  const start = Date.now();
  let attemptCount = 0;
  for await (const _ of backoff()) {
    try {
      const r = await func();
      return r;
    } catch (e) {
      attemptCount += 1;
      if ((attemptCount > attemps)) {
        throw new Error(`Too many attempts: ${e}`);
      }
      if (Date.now() - start > timeout) {
        throw new Error(`Timeout: ${e}`);
      }
    }
  }
}

export function identity (x) {
  return x;
}

export function * repeat (x) {
  while (true) {
    yield x;
  }
}

export function * functoGen (func, x0 = 0) {
  let x = x0;
  yield x;
  while (true) {
    yield x = func(x);
  }
}

export async function * waits (times) {
  for (const t of times) {
    await wait(t); // eslint-disable-line no-await-in-loop
    yield t;
  }
}

export async function * periodicWaits (time) {
  yield * waits(repeat(time));
}

export async function * monitorStream (stream, func) {
  let i = 0;
  for await (const item of stream) {
    func(i, item);
    yield item;
    i += 1;
  }
}

export async function takeAll (stream) {
  const out = [];
  console.log('get parts!');
  for await (const x of stream) {
    console.log('got part', x);
    out.push(x);
  }
  return out;
}

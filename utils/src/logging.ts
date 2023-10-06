/* eslint no-console: 0 */

import config from './config.js';
import { FifoMap } from './cache.js';
import { Target } from './target.js';

export function getGlobal () {
  if (typeof global !== 'undefined') return global;
  return window;
}

class LogBook extends FifoMap {
  print = true;

  count = 0;

  onLog = new Target();

  constructor (maxSize = 1000) {
    super(maxSize);
  }

  dump () {
    return Array.from(this).reverse();
  }

  prettyLog () {
    let out = '';
    for (const [i, entry] of this.dump()) {
      out += `
      ${i}:
        ${entry}`;
    }
    return out;
  }

  log (...entries) {
    if (this.print) {
      console.log(...entries); // eslint-disable-line
    }
    this.set(this.count, entries);
    this.count += 1;
    this.onLog.dispatch(entries);
  }
}

function makeLog () {
  const logBook = new LogBook();
  const log = logBook.log.bind(logBook);

  log.onLog = (f) => logBook.onLog.addListener(f);

  return { logBook, log };
}

export const { log, logBook } = makeLog();

const TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4;

export const LOG_LEVELS = {
  TRACE,
  DEBUG,
  INFO,
  WARN,
  ERROR,
};

log.debug = (...args) => {
  if (config.LOG_LEVEL <= DEBUG) {
    log(...args);
  }
};
log.info = (...args) => {
  if (config.LOG_LEVEL <= INFO) {
    log(...args);
  }
};
log.error = console.error;

const alph = 'abcdefghijklmnopqrstuvwxyz';

export const randName = (len = 6) => {
  return new Array(len).fill(0).map(() => alph[Math.floor(Math.random() * 26)]).join('');
};

export class LoggableMixin {
  name: string;
  extraPrefix?: string;

  constructor ({ name = randName() } = {}) {
    Object.assign(this, { name });
  }

  log (...x) {
    log.info(`${this.constructor.name}[${this.name}]${this.extraPrefix ?? ''}`, ...x);
  }
}
